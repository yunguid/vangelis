#[macro_use]
extern crate rocket;

use rocket::fs::{relative, FileServer};
use rocket::http::Status;
use rocket::response::status;
use rocket::serde::{json::Json, Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
struct PipelineJobRequest {
    artist: Option<String>,
    song: Option<String>,
    source_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(crate = "rocket::serde")]
struct ApiError {
    error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct PipelineArtifact {
    name: String,
    kind: String,
    path: String,
    #[serde(default)]
    url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct PipelineJob {
    id: String,
    status: String,
    step: String,
    message: String,
    artist: Option<String>,
    song: Option<String>,
    source_url: Option<String>,
    search_query: String,
    created_at: u128,
    updated_at: u128,
    tempo_bpm: Option<f32>,
    #[serde(default)]
    artifacts: Vec<PipelineArtifact>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(crate = "rocket::serde")]
struct ToolStatus {
    label: String,
    ready: bool,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(crate = "rocket::serde")]
struct PipelineHealth {
    ready: bool,
    python_runtime: String,
    bootstrap_command: String,
    tools: Vec<ToolStatus>,
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn generated_root() -> PathBuf {
    project_root().join("generated")
}

fn pipeline_jobs_root() -> PathBuf {
    generated_root().join("pipeline-jobs")
}

fn pipeline_script_path() -> PathBuf {
    project_root().join("pipeline").join("midi_pipeline.py")
}

fn pipeline_python() -> String {
    let local_runtime = project_root().join("pipeline").join(".venv").join("bin").join("python");
    if local_runtime.exists() {
        return local_runtime.to_string_lossy().to_string();
    }

    if command_exists("python3.11") {
        return "python3.11".to_string();
    }

    if command_exists("python3.12") {
        return "python3.12".to_string();
    }

    "python3".to_string()
}

fn bootstrap_command() -> String {
    format!("cd {} && ./pipeline/bootstrap.sh", project_root().display())
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn command_exists(command: &str) -> bool {
    env::var_os("PATH").map_or(false, |paths| {
        env::split_paths(&paths).any(|path| path.join(command).is_file())
    })
}

fn python_module_exists(python_runtime: &str, module_name: &str) -> bool {
    Command::new(python_runtime)
        .arg("-c")
        .arg(format!(
            "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec({module_name:?}) else 1)"
        ))
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn sanitize_field(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
}

fn build_search_query(
    artist: Option<&str>,
    song: Option<&str>,
    source_url: Option<&str>,
) -> Option<String> {
    if let Some(url) = source_url.filter(|value| !value.trim().is_empty()) {
        return Some(url.trim().to_string());
    }

    let parts = [artist, song]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return None;
    }

    Some(format!("ytsearch1:{}", parts.join(" - ")))
}

fn job_path(job_id: &str) -> PathBuf {
    pipeline_jobs_root().join(job_id).join("job.json")
}

fn job_dir(job_id: &str) -> PathBuf {
    pipeline_jobs_root().join(job_id)
}

fn enrich_artifact_urls(job_id: &str, job: &mut PipelineJob) {
    for artifact in &mut job.artifacts {
        artifact.url = format!(
            "/generated/pipeline-jobs/{job_id}/{}",
            artifact.path.trim_start_matches('/')
        );
    }
}

fn write_job(job_dir: &Path, job: &PipelineJob) -> Result<(), String> {
    fs::create_dir_all(job_dir)
        .map_err(|error| format!("Failed to create job directory: {error}"))?;

    let json = serde_json::to_string_pretty(job)
        .map_err(|error| format!("Failed to serialize job payload: {error}"))?;

    fs::write(job_dir.join("job.json"), json)
        .map_err(|error| format!("Failed to write job payload: {error}"))?;

    Ok(())
}

fn read_job(job_id: &str) -> Result<PipelineJob, String> {
    let json = fs::read_to_string(job_path(job_id))
        .map_err(|error| format!("Failed to read job payload: {error}"))?;

    let mut job: PipelineJob = serde_json::from_str(&json)
        .map_err(|error| format!("Failed to parse job payload: {error}"))?;

    enrich_artifact_urls(job_id, &mut job);
    Ok(job)
}

fn delete_job(job_id: &str) -> Result<(), String> {
    let target_dir = job_dir(job_id);
    if !target_dir.exists() {
        return Err("Study not found.".to_string());
    }

    fs::remove_dir_all(&target_dir)
        .map_err(|error| format!("Failed to delete study: {error}"))?;

    Ok(())
}

fn list_jobs() -> Vec<PipelineJob> {
    let mut jobs = fs::read_dir(pipeline_jobs_root())
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let job_id = entry.file_name().to_string_lossy().to_string();
            if job_id.is_empty() {
                return None;
            }

            read_job(&job_id).ok()
        })
        .collect::<Vec<_>>();

    jobs.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    jobs
}

fn spawn_pipeline_job(
    job_dir: &Path,
    artist: Option<&str>,
    song: Option<&str>,
    source_url: Option<&str>,
) -> Result<(), String> {
    let python_runtime = pipeline_python();
    let mut command = Command::new(&python_runtime);

    command
        .arg(pipeline_script_path())
        .arg("--job-dir")
        .arg(job_dir)
        .current_dir(project_root())
        .env("PYTHONUNBUFFERED", "1");

    if let Some(value) = artist {
        command.arg("--artist").arg(value);
    }

    if let Some(value) = song {
        command.arg("--song").arg(value);
    }

    if let Some(value) = source_url {
        command.arg("--source-url").arg(value);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to launch pipeline job: {error}"))
}

#[get("/api/pipeline/health")]
fn pipeline_health() -> Json<PipelineHealth> {
    let python_runtime = pipeline_python();
    let python_ready = Command::new(&python_runtime)
        .arg("--version")
        .status()
        .map(|status| status.success())
        .unwrap_or(false);

    let tools = vec![
        ToolStatus {
            label: "Python runtime".to_string(),
            ready: python_ready,
            detail: python_runtime.clone(),
        },
        ToolStatus {
            label: "ffmpeg".to_string(),
            ready: command_exists("ffmpeg"),
            detail: "Required for yt-dlp audio extraction.".to_string(),
        },
        ToolStatus {
            label: "yt-dlp".to_string(),
            ready: python_ready && python_module_exists(&python_runtime, "yt_dlp"),
            detail: "Python module used for source download.".to_string(),
        },
        ToolStatus {
            label: "demucs".to_string(),
            ready: python_ready && python_module_exists(&python_runtime, "demucs"),
            detail: "Python module used for stem separation.".to_string(),
        },
        ToolStatus {
            label: "basic_pitch".to_string(),
            ready: python_ready && python_module_exists(&python_runtime, "basic_pitch"),
            detail: "Python module used for stem-to-MIDI transcription.".to_string(),
        },
        ToolStatus {
            label: "pretty_midi".to_string(),
            ready: python_ready && python_module_exists(&python_runtime, "pretty_midi"),
            detail: "Used to merge stem MIDI files into one arrangement.".to_string(),
        },
        ToolStatus {
            label: "torchcodec".to_string(),
            ready: python_ready && python_module_exists(&python_runtime, "torchcodec"),
            detail: "Required by torchaudio when Demucs writes stem audio.".to_string(),
        },
    ];

    let ready = tools.iter().all(|tool| tool.ready);

    Json(PipelineHealth {
        ready,
        python_runtime,
        bootstrap_command: bootstrap_command(),
        tools,
    })
}

#[post("/api/pipeline/jobs", format = "json", data = "<request>")]
fn create_pipeline_job(
    request: Json<PipelineJobRequest>,
) -> Result<Json<PipelineJob>, status::Custom<Json<ApiError>>> {
    let artist = sanitize_field(&request.artist);
    let song = sanitize_field(&request.song);
    let source_url = sanitize_field(&request.source_url);
    let search_query = build_search_query(artist.as_deref(), song.as_deref(), source_url.as_deref())
        .ok_or_else(|| {
            status::Custom(
                Status::BadRequest,
                Json(ApiError {
                    error: "Provide an artist and song or a source URL.".to_string(),
                }),
            )
        })?;

    let job_id = format!("job-{}-{}", now_millis(), std::process::id());
    let job_dir = pipeline_jobs_root().join(&job_id);
    let created_at = now_millis();
    let job = PipelineJob {
        id: job_id.clone(),
        status: "queued".to_string(),
        step: "queued".to_string(),
        message: "Queued for download.".to_string(),
        artist: artist.clone(),
        song: song.clone(),
        source_url: source_url.clone(),
        search_query,
        created_at,
        updated_at: created_at,
        tempo_bpm: None,
        artifacts: Vec::new(),
        error: None,
    };

    write_job(&job_dir, &job).map_err(|error| {
        status::Custom(
            Status::InternalServerError,
            Json(ApiError { error }),
        )
    })?;

    spawn_pipeline_job(&job_dir, artist.as_deref(), song.as_deref(), source_url.as_deref()).map_err(
        |error| {
            status::Custom(
                Status::InternalServerError,
                Json(ApiError { error }),
            )
        },
    )?;

    let mut response = job.clone();
    enrich_artifact_urls(&job_id, &mut response);
    Ok(Json(response))
}

#[get("/api/pipeline/jobs")]
fn list_pipeline_jobs() -> Json<Vec<PipelineJob>> {
    Json(list_jobs())
}

#[get("/api/pipeline/jobs/<job_id>")]
fn get_pipeline_job(
    job_id: &str,
) -> Result<Json<PipelineJob>, status::Custom<Json<ApiError>>> {
    read_job(job_id).map(Json).map_err(|error| {
        status::Custom(
            Status::NotFound,
            Json(ApiError { error }),
        )
    })
}

#[delete("/api/pipeline/jobs/<job_id>")]
fn delete_pipeline_job(
    job_id: &str,
) -> Result<status::NoContent, status::Custom<Json<ApiError>>> {
    delete_job(job_id).map(|_| status::NoContent).map_err(|error| {
        status::Custom(
            Status::NotFound,
            Json(ApiError { error }),
        )
    })
}

#[launch]
fn rocket() -> _ {
    let _ = fs::create_dir_all(pipeline_jobs_root());

    rocket::build()
        .mount(
            "/",
            routes![
                pipeline_health,
                create_pipeline_job,
                list_pipeline_jobs,
                get_pipeline_job,
                delete_pipeline_job
            ],
        )
        .mount("/generated", FileServer::from(relative!("../generated")))
        .mount("/", FileServer::from(relative!("../frontend/dist")).rank(30))
}
