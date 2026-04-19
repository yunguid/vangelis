from __future__ import annotations

import argparse
import json
import math
import shlex
import shutil
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

SOURCE_STEM_NAME = "source"
DEFAULT_TEMPO_BPM = 120.0
TRANSCRIPTION_STEMS = ("bass", "vocals", "other")
PROGRAM_BY_STEM = {
    "bass": 34,
    "vocals": 54,
    "other": 81,
}
DISPLAY_NAME_BY_STEM = {
    "bass": "Bass MIDI",
    "vocals": "Top line MIDI",
    "other": "Other melody MIDI",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_millis() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def read_job_state(job_dir: Path) -> dict:
    job_file = job_dir / "job.json"
    if not job_file.exists():
        return {}
    return json.loads(job_file.read_text())


def write_job_state(job_dir: Path, **updates: object) -> None:
    state = read_job_state(job_dir)
    state.update(updates)
    state["updated_at"] = state.get("updated_at") or now_millis()
    if "updated_at" in updates:
        state["updated_at"] = updates["updated_at"]
    else:
        state["updated_at"] = now_millis()

    tmp_file = job_dir / "job.json.tmp"
    tmp_file.write_text(json.dumps(state, indent=2))
    tmp_file.replace(job_dir / "job.json")


def append_log(job_dir: Path, message: str) -> None:
    with (job_dir / "job.log").open("a", encoding="utf-8") as handle:
        handle.write(f"[{now_iso()}] {message}\n")


def set_step(job_dir: Path, status: str, step: str, message: str, **updates: object) -> None:
    append_log(job_dir, f"{status.upper()} {step}: {message}")
    write_job_state(job_dir, status=status, step=step, message=message, **updates)


def run_command(job_dir: Path, args: list[str], cwd: Path | None = None) -> None:
    append_log(job_dir, "$ " + " ".join(shlex.quote(arg) for arg in args))
    process = subprocess.Popen(
        args,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        cwd=str(cwd) if cwd else None,
    )

    if process.stdout is not None:
        for line in process.stdout:
            cleaned = line.rstrip()
            if cleaned:
                append_log(job_dir, cleaned)

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(
            f"Command failed with exit code {return_code}: {' '.join(args)}"
        )


def estimate_tempo(job_dir: Path, audio_path: Path) -> float:
    try:
        import librosa

        samples, sample_rate = librosa.load(str(audio_path), mono=True, duration=180)
        tempo, _ = librosa.beat.beat_track(y=samples, sr=sample_rate)
        tempo_value = tempo.tolist() if hasattr(tempo, "tolist") else tempo
        while isinstance(tempo_value, list):
            if not tempo_value:
                raise ValueError("librosa returned an empty tempo array")
            tempo_value = tempo_value[0]

        tempo_value = float(tempo_value)
        if math.isfinite(tempo_value) and tempo_value > 0:
            return tempo_value
    except Exception as error:  # pragma: no cover - best effort only
        append_log(job_dir, f"Tempo estimation fallback: {error}")

    return DEFAULT_TEMPO_BPM


def download_audio(job_dir: Path, search_query: str) -> Path:
    downloads_dir = job_dir / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)

    output_template = downloads_dir / f"{SOURCE_STEM_NAME}.%(ext)s"
    run_command(
        job_dir,
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "-f",
            "bestaudio",
            "--no-playlist",
            "--extract-audio",
            "--audio-format",
            "wav",
            search_query,
            "-o",
            str(output_template),
        ],
    )

    wav_path = downloads_dir / f"{SOURCE_STEM_NAME}.wav"
    if wav_path.exists():
        return wav_path

    matches = sorted(downloads_dir.glob(f"{SOURCE_STEM_NAME}.*"))
    if not matches:
        raise RuntimeError("yt-dlp did not produce an audio file.")

    return matches[0]


def split_stems(job_dir: Path, audio_path: Path) -> Path:
    stems_root = job_dir / "stems"
    stems_root.mkdir(parents=True, exist_ok=True)

    run_command(
        job_dir,
        [
            sys.executable,
            "-m",
            "demucs",
            "-n",
            "htdemucs",
            "-o",
            "stems",
            str(audio_path.relative_to(job_dir)),
        ],
        cwd=job_dir,
    )

    stem_dir = stems_root / "htdemucs" / SOURCE_STEM_NAME
    if not stem_dir.exists():
        raise RuntimeError("Demucs completed but the expected stem folder was not created.")

    return stem_dir


def stem_pitch_range(stem_name: str) -> tuple[float | None, float | None]:
    if stem_name == "bass":
        return (30.0, 330.0)
    if stem_name == "vocals":
        return (80.0, 1760.0)
    if stem_name == "other":
        return (110.0, 2500.0)
    return (None, None)


def transcribe_stem(job_dir: Path, stem_name: str, stem_path: Path, tempo_bpm: float) -> Path | None:
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict_and_save

    midi_dir = job_dir / "midi"
    midi_dir.mkdir(parents=True, exist_ok=True)
    existing_midis = {path.resolve() for path in midi_dir.glob("*.mid")}
    minimum_frequency, maximum_frequency = stem_pitch_range(stem_name)

    predict_and_save(
        audio_path_list=[stem_path],
        output_directory=midi_dir,
        save_midi=True,
        sonify_midi=False,
        save_model_outputs=False,
        save_notes=False,
        model_or_model_path=ICASSP_2022_MODEL_PATH,
        minimum_frequency=minimum_frequency,
        maximum_frequency=maximum_frequency,
        multiple_pitch_bends=False,
        melodia_trick=(stem_name != "bass"),
        midi_tempo=tempo_bpm,
    )

    created_midis = [
        path for path in midi_dir.glob("*.mid")
        if path.resolve() not in existing_midis
    ]
    if not created_midis:
        append_log(job_dir, f"No MIDI was created for {stem_name}.")
        return None

    source_midi = created_midis[0]
    canonical_path = midi_dir / f"{stem_name}.mid"
    if source_midi != canonical_path:
        source_midi.replace(canonical_path)

    return canonical_path


def merge_midis(job_dir: Path, stem_midis: dict[str, Path], tempo_bpm: float) -> Path:
    import pretty_midi

    combined = pretty_midi.PrettyMIDI(initial_tempo=tempo_bpm)

    for stem_name, midi_path in stem_midis.items():
        source_midi = pretty_midi.PrettyMIDI(str(midi_path))
        for index, instrument in enumerate(source_midi.instruments):
            merged_instrument = pretty_midi.Instrument(
                program=PROGRAM_BY_STEM.get(stem_name, instrument.program),
                is_drum=False,
                name=DISPLAY_NAME_BY_STEM.get(stem_name, stem_name.title())
                if index == 0
                else f"{DISPLAY_NAME_BY_STEM.get(stem_name, stem_name.title())} {index + 1}",
            )

            for note in instrument.notes:
                merged_instrument.notes.append(
                    pretty_midi.Note(
                        velocity=note.velocity,
                        pitch=note.pitch,
                        start=note.start,
                        end=note.end,
                    )
                )

            for pitch_bend in instrument.pitch_bends:
                merged_instrument.pitch_bends.append(
                    pretty_midi.PitchBend(
                        pitch=pitch_bend.pitch,
                        time=pitch_bend.time,
                    )
                )

            for control_change in instrument.control_changes:
                merged_instrument.control_changes.append(
                    pretty_midi.ControlChange(
                        number=control_change.number,
                        value=control_change.value,
                        time=control_change.time,
                    )
                )

            combined.instruments.append(merged_instrument)

    artifacts_dir = job_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    combined_path = artifacts_dir / "full-arrangement.mid"
    combined.write(str(combined_path))
    return combined_path


def build_artifacts(
    job_dir: Path, combined_path: Path | None, stem_midis: dict[str, Path]
) -> list[dict[str, str]]:
    artifacts: list[dict[str, str]] = []

    if combined_path is not None:
        artifacts.append(
            {
                "name": "Full arrangement MIDI",
                "kind": "merged-midi",
                "path": combined_path.relative_to(job_dir).as_posix(),
            }
        )

    for stem_name, midi_path in stem_midis.items():
        artifacts.append(
            {
                "name": DISPLAY_NAME_BY_STEM.get(stem_name, stem_name.title()),
                "kind": "stem-midi",
                "path": midi_path.relative_to(job_dir).as_posix(),
            }
        )

    return artifacts


def ensure_runtime(job_dir: Path) -> None:
    missing = []
    if shutil.which("ffmpeg") is None:
        missing.append("ffmpeg")

    for module_name in ("yt_dlp", "demucs", "basic_pitch", "pretty_midi", "torchcodec"):
        try:
            __import__(module_name)
        except Exception:
            missing.append(module_name)

    if missing:
        raise RuntimeError(
            "Missing pipeline dependencies: "
            + ", ".join(missing)
            + ". Run ./pipeline/bootstrap.sh first."
        )

    append_log(job_dir, f"Using Python runtime: {sys.executable}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local song-to-MIDI pipeline.")
    parser.add_argument("--job-dir", required=True, type=Path)
    parser.add_argument("--artist")
    parser.add_argument("--song")
    parser.add_argument("--source-url")
    return parser.parse_args()


def build_search_query(artist: str | None, song: str | None, source_url: str | None) -> str:
    if source_url:
        return source_url.strip()

    parts = [part.strip() for part in (artist or "", song or "") if part and part.strip()]
    if not parts:
        raise RuntimeError("Provide either a source URL or an artist/song pair.")

    return f"ytsearch1:{' - '.join(parts)}"


def main() -> int:
    args = parse_args()
    job_dir = args.job_dir.resolve()
    job_dir.mkdir(parents=True, exist_ok=True)

    search_query = build_search_query(args.artist, args.song, args.source_url)
    write_job_state(
        job_dir,
        created_at=read_job_state(job_dir).get("created_at", now_iso()),
        artist=args.artist,
        song=args.song,
        source_url=args.source_url,
        search_query=search_query,
        artifacts=[],
        error=None,
    )

    try:
        set_step(job_dir, "running", "bootstrap", "Checking local pipeline runtime.")
        ensure_runtime(job_dir)

        set_step(job_dir, "running", "download", "Downloading source audio.")
        audio_path = download_audio(job_dir, search_query)

        tempo_bpm = estimate_tempo(job_dir, audio_path)
        write_job_state(job_dir, tempo_bpm=tempo_bpm)

        set_step(job_dir, "running", "separate", "Splitting stems with Demucs.")
        stem_dir = split_stems(job_dir, audio_path)

        stem_midis: dict[str, Path] = {}
        for stem_name in TRANSCRIPTION_STEMS:
            stem_path = stem_dir / f"{stem_name}.wav"
            if not stem_path.exists():
                append_log(job_dir, f"Skipping missing stem: {stem_name}")
                continue

            set_step(
                job_dir,
                "running",
                f"transcribe-{stem_name}",
                f"Building MIDI for {stem_name}.",
            )
            midi_path = transcribe_stem(job_dir, stem_name, stem_path, tempo_bpm)
            if midi_path is not None:
                stem_midis[stem_name] = midi_path

        if not stem_midis:
            raise RuntimeError("No MIDI files were created from the separated stems.")

        set_step(job_dir, "running", "merge", "Merging stem MIDI files.")
        combined_path = merge_midis(job_dir, stem_midis, tempo_bpm)

        set_step(
            job_dir,
            "completed",
            "completed",
            "MIDI pipeline finished.",
            artifacts=build_artifacts(job_dir, combined_path, stem_midis),
            error=None,
        )
        return 0
    except Exception as error:
        append_log(job_dir, traceback.format_exc())
        set_step(
            job_dir,
            "failed",
            "failed",
            "Pipeline failed.",
            error=str(error),
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
