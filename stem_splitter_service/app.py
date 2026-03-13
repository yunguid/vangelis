from __future__ import annotations

import math
import os
import shutil
import threading
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
import torchaudio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

APP_ROOT = Path(__file__).resolve().parent
ARTIFACT_ROOT = APP_ROOT / "artifacts"
ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

MODEL_BUNDLE = torchaudio.pipelines.HDEMUCS_HIGH_MUSDB_PLUS
TARGET_SAMPLE_RATE = MODEL_BUNDLE.sample_rate
MODEL_LABEL = "torchaudio/hdemucs_high_musdb_plus"

DEFAULT_HOST = os.getenv("STEM_SPLITTER_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.getenv("STEM_SPLITTER_PORT", "8718"))
MAX_UPLOAD_BYTES = int(os.getenv("STEM_SPLITTER_MAX_UPLOAD_BYTES", str(250 * 1024 * 1024)))
CHUNK_SECONDS = float(os.getenv("STEM_SPLITTER_CHUNK_SECONDS", "8.0"))
OVERLAP_SECONDS = float(os.getenv("STEM_SPLITTER_OVERLAP_SECONDS", "1.0"))
MAX_JOB_HISTORY = int(os.getenv("STEM_SPLITTER_MAX_JOB_HISTORY", "12"))
DEVICE_PREFERENCE = os.getenv("STEM_SPLITTER_DEVICE", "auto").strip().lower()

SOURCE_KEYS = ("drums", "bass", "other", "vocals")
SOURCE_LABELS = {
    "other": "sample",
    "drums": "drums",
    "bass": "bass",
    "vocals": "vocals",
}
DISPLAY_ORDER = {
    "sample": 0,
    "drums": 1,
    "bass": 2,
    "vocals": 3,
}

app = FastAPI(title="Vangelis Stem Splitter", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/artifacts", StaticFiles(directory=str(ARTIFACT_ROOT)), name="artifacts")


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_filename(value: str, fallback: str = "track.wav") -> str:
    cleaned = "".join(character if character.isalnum() or character in {"-", "_", "."} else "-" for character in value.strip())
    collapsed = cleaned.replace("--", "-").strip("-")
    return collapsed or fallback


def get_base_name(value: str) -> str:
    path = sanitize_filename(value)
    stem = Path(path).stem
    return stem or "track"


def resolve_source_name_from_url(url: str) -> str:
    try:
        path_name = Path(urllib.parse.urlparse(url).path).name
        return sanitize_filename(path_name or "track.wav")
    except Exception:
        return "track.wav"


def choose_device() -> str:
    if DEVICE_PREFERENCE in {"cpu", "mps"}:
        return DEVICE_PREFERENCE
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def normalize_waveform(waveform: torch.Tensor, sample_rate: int) -> torch.Tensor:
    if waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)

    if waveform.size(0) == 1:
        waveform = waveform.repeat(2, 1)
    elif waveform.size(0) > 2:
        waveform = waveform[:2]

    waveform = waveform.to(torch.float32)
    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sample_rate, TARGET_SAMPLE_RATE)

    return waveform.contiguous()


@dataclass
class StemArtifact:
    stem_id: str
    source_key: str
    label: str
    relative_path: str
    suggested_file_name: str


@dataclass
class JobRecord:
    job_id: str
    source_name: str
    source_relative_path: str
    status: str = "queued"
    status_message: str = "Queued."
    progress: float = 0.0
    created_at: str = field(default_factory=utcnow_iso)
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None
    logs: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    artifacts: list[StemArtifact] = field(default_factory=list)
    device_used: str | None = None

    @property
    def is_terminal(self) -> bool:
        return self.status in {"succeeded", "failed"}

    def log(self, message: str) -> None:
        self.logs.append(message)
        del self.logs[:-80]


jobs: dict[str, JobRecord] = {}
jobs_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=1)
model_lock = threading.Lock()
loaded_models: dict[str, torch.nn.Module] = {}


def get_job(job_id: str) -> JobRecord:
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


def trim_job_history() -> None:
    with jobs_lock:
        terminal_jobs = sorted(
            (job for job in jobs.values() if job.is_terminal),
            key=lambda item: item.completed_at or item.created_at,
        )
        while len(terminal_jobs) > MAX_JOB_HISTORY:
            stale = terminal_jobs.pop(0)
            jobs.pop(stale.job_id, None)
            artifact_dir = ARTIFACT_ROOT / stale.job_id
            shutil.rmtree(artifact_dir, ignore_errors=True)


def load_model(device: str) -> torch.nn.Module:
    with model_lock:
        cached = loaded_models.get(device)
        if cached is not None:
            return cached

        model = MODEL_BUNDLE.get_model()
        model = model.to(device)
        model.eval()
        loaded_models[device] = model
        return model


def build_weights(length: int, fade_in: bool, fade_out: bool, overlap_samples: int) -> torch.Tensor:
    weights = torch.ones(length, dtype=torch.float32)
    fade_length = min(overlap_samples, length)

    if fade_in and fade_length > 0:
        weights[:fade_length] = torch.linspace(0.0, 1.0, fade_length, dtype=torch.float32)

    if fade_out and fade_length > 0:
        tail = torch.linspace(1.0, 0.0, fade_length, dtype=torch.float32)
        weights[-fade_length:] = torch.minimum(weights[-fade_length:], tail)

    return weights


def separate_waveform(waveform: torch.Tensor, job: JobRecord) -> tuple[torch.Tensor, str]:
    total_samples = waveform.shape[-1]
    chunk_samples = max(int(TARGET_SAMPLE_RATE * CHUNK_SECONDS), TARGET_SAMPLE_RATE)
    overlap_samples = min(int(TARGET_SAMPLE_RATE * OVERLAP_SECONDS), max(chunk_samples // 2, 1))
    step_samples = max(chunk_samples - overlap_samples, 1)
    chunk_starts = list(range(0, total_samples, step_samples)) or [0]

    preferred_device = choose_device()
    fallback_devices = [preferred_device]
    if preferred_device != "cpu":
        fallback_devices.append("cpu")

    last_error: Exception | None = None

    for device in fallback_devices:
        try:
            model = load_model(device)
            sources = len(model.sources)
            accumulated = torch.zeros((sources, 2, total_samples), dtype=torch.float32)
            normalization = torch.zeros(total_samples, dtype=torch.float32)

            with torch.inference_mode():
                for chunk_index, start in enumerate(chunk_starts):
                    end = min(start + chunk_samples, total_samples)
                    valid_length = end - start
                    chunk = waveform[:, start:end]
                    if valid_length < chunk_samples:
                        chunk = torch.nn.functional.pad(chunk, (0, chunk_samples - valid_length))

                    job.status_message = f"Separating chunk {chunk_index + 1} of {len(chunk_starts)} on {device}."
                    job.progress = min(0.15 + (chunk_index / max(len(chunk_starts), 1)) * 0.72, 0.9)

                    output = model(chunk.unsqueeze(0).to(device))[0].to("cpu")[..., :valid_length]
                    weights = build_weights(
                        valid_length,
                        fade_in=chunk_index > 0,
                        fade_out=end < total_samples,
                        overlap_samples=overlap_samples,
                    )

                    accumulated[..., start:end] += output * weights.view(1, 1, -1)
                    normalization[start:end] += weights

            normalization = normalization.clamp_min(1e-6)
            stems = accumulated / normalization.view(1, 1, -1)

            if device == "mps" and hasattr(torch.mps, "empty_cache"):
                torch.mps.empty_cache()

            return stems, device
        except Exception as error:  # noqa: PERF203
            last_error = error
            job.warnings.append(f"{device.upper()} path failed, falling back." if device != "cpu" else "CPU path failed.")

    if last_error is None:
        raise RuntimeError("Stem separation failed without an error.")
    raise last_error


def save_stems(job: JobRecord, stems: torch.Tensor) -> list[StemArtifact]:
    job_dir = ARTIFACT_ROOT / job.job_id
    stem_dir = job_dir / "stems"
    stem_dir.mkdir(parents=True, exist_ok=True)

    artifacts: list[StemArtifact] = []
    source_base = get_base_name(job.source_name)

    for source_key, stem_waveform in zip(SOURCE_KEYS, stems):
        stem_id = SOURCE_LABELS[source_key]
        file_name = f"{source_base}-{stem_id}.wav"
        output_path = stem_dir / file_name
        torchaudio.save(str(output_path), stem_waveform, TARGET_SAMPLE_RATE)
        artifacts.append(
            StemArtifact(
                stem_id=stem_id,
                source_key=source_key,
                label=stem_id.capitalize(),
                relative_path=f"{job.job_id}/stems/{file_name}",
                suggested_file_name=file_name,
            )
        )

    return artifacts


def process_job(job_id: str) -> None:
    job = get_job(job_id)
    job.started_at = utcnow_iso()
    job.status = "processing"
    job.status_message = "Loading source audio."
    job.progress = 0.05
    job.log("Loading input audio.")

    source_path = ARTIFACT_ROOT / job.source_relative_path

    try:
        waveform, sample_rate = torchaudio.load(str(source_path))
        waveform = normalize_waveform(waveform, sample_rate)
        job.log(f"Decoded audio to {TARGET_SAMPLE_RATE} Hz stereo.")
        job.status_message = "Running Demucs separation."
        job.progress = 0.12

        stems, device_used = separate_waveform(waveform, job)
        job.device_used = device_used
        job.log(f"Separated stems on {device_used}.")

        job.status_message = "Writing stems."
        job.progress = 0.94
        job.artifacts = save_stems(job, stems)
        job.status = "succeeded"
        job.status_message = "Stems ready."
        job.progress = 1.0
        job.completed_at = utcnow_iso()
        trim_job_history()
    except Exception as error:  # noqa: PERF203
        job.status = "failed"
        job.status_message = "Stem split failed."
        job.error = str(error)
        job.log(f"Failure: {error}")
        job.completed_at = utcnow_iso()


def build_job_payload(job: JobRecord, request: Request) -> dict[str, Any]:
    base_url = str(request.base_url).rstrip("/")
    source_url = f"{base_url}/artifacts/{job.source_relative_path}" if job.source_relative_path else None

    return {
        "jobId": job.job_id,
        "status": job.status,
        "statusMessage": job.status_message,
        "progress": job.progress,
        "sourceName": job.source_name,
        "sourceUrl": source_url,
        "stems": [
            {
                "id": artifact.stem_id,
                "label": artifact.label,
                "sourceKey": artifact.source_key,
                "url": f"{base_url}/artifacts/{artifact.relative_path}",
                "suggestedFileName": artifact.suggested_file_name,
            }
            for artifact in sorted(job.artifacts, key=lambda item: DISPLAY_ORDER.get(item.stem_id, 99))
        ],
        "warnings": job.warnings,
        "error": job.error,
        "logs": "\n".join(job.logs),
        "deviceUsed": job.device_used,
        "createdAt": job.created_at,
        "startedAt": job.started_at,
        "completedAt": job.completed_at,
        "isTerminal": job.is_terminal,
    }


def build_configuration() -> dict[str, Any]:
    with jobs_lock:
        queue_depth = sum(1 for job in jobs.values() if not job.is_terminal)

    return {
        "workerOnline": True,
        "workerUrl": f"http://{DEFAULT_HOST}:{DEFAULT_PORT}",
        "model": MODEL_LABEL,
        "devicePreference": choose_device(),
        "modelLoaded": bool(loaded_models),
        "maximumUploadBytes": MAX_UPLOAD_BYTES,
        "chunkSeconds": CHUNK_SECONDS,
        "overlapSeconds": OVERLAP_SECONDS,
        "queueDepth": queue_depth,
        "supportedStems": [
            {"id": "sample", "label": "Sample"},
            {"id": "drums", "label": "Drums"},
            {"id": "bass", "label": "Bass"},
            {"id": "vocals", "label": "Vocals"},
        ],
    }


def persist_upload(source_name: str, source_url: str | None, upload_bytes: bytes | None) -> tuple[str, str]:
    job_id = uuid.uuid4().hex[:12]
    job_dir = ARTIFACT_ROOT / job_id
    source_dir = job_dir / "source"
    source_dir.mkdir(parents=True, exist_ok=True)

    if upload_bytes is not None:
        file_name = sanitize_filename(source_name)
        target_path = source_dir / file_name
        target_path.write_bytes(upload_bytes)
        return job_id, f"{job_id}/source/{file_name}"

    if not source_url:
        raise HTTPException(status_code=400, detail="Either a file or source_url is required.")

    file_name = resolve_source_name_from_url(source_url)
    target_path = source_dir / file_name
    with urllib.request.urlopen(source_url) as response, target_path.open("wb") as output_file:
        shutil.copyfileobj(response, output_file)
    return job_id, f"{job_id}/source/{file_name}"


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "version": 1,
        "configuration": build_configuration(),
    }


@app.post("/api/stem-jobs")
async def create_stem_job(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")
    upload_bytes: bytes | None = None
    source_name = "track.wav"
    source_url: str | None = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        source_url = str(form.get("source_url") or "").strip() or None
        upload = form.get("file")

        if upload is not None and hasattr(upload, "filename"):
            source_name = sanitize_filename(str(upload.filename or "track.wav"))
            upload_bytes = await upload.read()
    else:
        payload = await request.json()
        source_url = str(payload.get("source_url") or "").strip() or None
        if payload.get("source_name"):
            source_name = sanitize_filename(str(payload["source_name"]))

    if upload_bytes is not None and len(upload_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds the local worker limit.")

    if upload_bytes is None and not source_url:
        raise HTTPException(status_code=400, detail="Either a file or source_url is required.")

    job_id, source_relative_path = persist_upload(source_name, source_url, upload_bytes)
    source_name = Path(source_relative_path).name
    job = JobRecord(
        job_id=job_id,
        source_name=source_name,
        source_relative_path=source_relative_path,
    )
    job.log("Job queued.")

    with jobs_lock:
        jobs[job_id] = job

    executor.submit(process_job, job_id)

    return {
        "version": 1,
        "configuration": build_configuration(),
        "job": build_job_payload(job, request),
    }


@app.get("/api/stem-jobs/{job_id}")
async def read_stem_job(job_id: str, request: Request) -> dict[str, Any]:
    job = get_job(job_id)
    return {
        "version": 1,
        "configuration": build_configuration(),
        "job": build_job_payload(job, request),
    }
