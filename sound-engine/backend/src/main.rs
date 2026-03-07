#[macro_use] extern crate rocket;

use rocket::fs::{FileServer, relative};
use rocket::serde::json::Json;
use rocket::serde::{Serialize, Deserialize};
use rocket::State;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ADSRValues {
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct EffectsValues {
    reverb: f32,
    delay: f32,
    distortion: f32,
    volume: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
struct EngineValues {
    pan: f32,
    use_filter: bool,
    filter_cutoff: f32,
    filter_resonance: f32,
    filter_mode: u8,
    unison_voices: u8,
    unison_detune: f32,
    use_fm: bool,
    fm_ratio: f32,
    fm_index: f32,
    lfo_rate: f32,
    lfo_depth: f32,
    lfo_target: u8,
}

impl Default for EngineValues {
    fn default() -> Self {
        Self {
            pan: 0.5,
            use_filter: false,
            filter_cutoff: 18_000.0,
            filter_resonance: 0.7,
            filter_mode: 0,
            unison_voices: 1,
            unison_detune: 0.0,
            use_fm: false,
            fm_ratio: 2.0,
            fm_index: 2.0,
            lfo_rate: 0.0,
            lfo_depth: 0.0,
            lfo_target: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Preset {
    name: String,
    waveform: String,
    adsr: ADSRValues,
    effects: EffectsValues,
    #[serde(default)]
    engine: EngineValues,
    #[serde(default)]
    author: String,
    #[serde(default)]
    description: String,
    #[serde(default = "default_timestamp")]
    created_at: u64,
}

fn default_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

struct PresetStore {
    presets: Arc<RwLock<HashMap<String, Preset>>>,
}

const SYSTEM_PRESET_KEYS: &[&str] = &[
    "default",
    "nocturne_piano",
    "aurora_glass",
    "cathedral_bloom",
    "bronze_reed",
    "ember_pulse",
    "dusty_tape",
    "analog_bass",
];

fn system_preset(
    name: &str,
    waveform: &str,
    adsr: ADSRValues,
    effects: EffectsValues,
    engine: EngineValues,
    description: &str,
) -> Preset {
    Preset {
        name: name.to_string(),
        waveform: waveform.to_string(),
        adsr,
        effects,
        engine,
        author: "System".to_string(),
        description: description.to_string(),
        created_at: default_timestamp(),
    }
}

impl PresetStore {
    fn new() -> Self {
        let mut initial_presets = HashMap::new();
        initial_presets.insert(
            "default".to_string(),
            system_preset(
                "Default",
                "Triangle",
                ADSRValues { attack: 0.012, decay: 0.18, sustain: 0.76, release: 0.42 },
                EffectsValues { reverb: 0.24, delay: 72.0, distortion: 0.02, volume: 0.68 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 13_200.0,
                    filter_resonance: 0.82,
                    unison_voices: 2,
                    unison_detune: 7.0,
                    ..EngineValues::default()
                },
                "The new house sound: polished, warm, and wide without becoming cinematic mush.",
            ),
        );

        initial_presets.insert(
            "nocturne_piano".to_string(),
            system_preset(
                "Nocturne Piano",
                "Triangle",
                ADSRValues { attack: 0.01, decay: 0.2, sustain: 0.64, release: 0.48 },
                EffectsValues { reverb: 0.32, delay: 44.0, distortion: 0.02, volume: 0.69 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 10_800.0,
                    filter_resonance: 0.86,
                    unison_voices: 2,
                    unison_detune: 4.0,
                    ..EngineValues::default()
                },
                "Romantic keys with felt edges, a tighter room, and enough sustain for lyrical lines.",
            ),
        );

        initial_presets.insert(
            "aurora_glass".to_string(),
            system_preset(
                "Aurora Glass",
                "Sine",
                ADSRValues { attack: 0.02, decay: 0.24, sustain: 0.48, release: 0.72 },
                EffectsValues { reverb: 0.46, delay: 138.0, distortion: 0.0, volume: 0.62 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 9_800.0,
                    filter_resonance: 0.94,
                    use_fm: true,
                    fm_ratio: 3.0,
                    fm_index: 4.8,
                    lfo_rate: 0.18,
                    lfo_depth: 0.08,
                    lfo_target: 3,
                    ..EngineValues::default()
                },
                "Bell-glass harmonics with a slow moving shimmer for high-register melodies and arpeggios.",
            ),
        );

        initial_presets.insert(
            "cathedral_bloom".to_string(),
            system_preset(
                "Cathedral Bloom",
                "Triangle",
                ADSRValues { attack: 0.78, decay: 0.34, sustain: 0.72, release: 1.9 },
                EffectsValues { reverb: 0.78, delay: 220.0, distortion: 0.01, volume: 0.58 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 8_200.0,
                    filter_resonance: 0.68,
                    unison_voices: 3,
                    unison_detune: 10.0,
                    lfo_rate: 0.08,
                    lfo_depth: 0.06,
                    lfo_target: 3,
                    ..EngineValues::default()
                },
                "A slower, wider bloom for pads and suspended chords that need weight and tail.",
            ),
        );

        initial_presets.insert(
            "bronze_reed".to_string(),
            system_preset(
                "Bronze Reed",
                "Sawtooth",
                ADSRValues { attack: 0.04, decay: 0.22, sustain: 0.66, release: 0.68 },
                EffectsValues { reverb: 0.28, delay: 96.0, distortion: 0.04, volume: 0.63 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 6_400.0,
                    filter_resonance: 1.08,
                    unison_voices: 2,
                    unison_detune: 9.0,
                    use_fm: true,
                    fm_ratio: 1.5,
                    fm_index: 1.6,
                    ..EngineValues::default()
                },
                "A brass-and-reed hybrid: darker core, metallic edge, and enough body for leads.",
            ),
        );

        initial_presets.insert(
            "ember_pulse".to_string(),
            system_preset(
                "Ember Pulse",
                "Sawtooth",
                ADSRValues { attack: 0.005, decay: 0.12, sustain: 0.44, release: 0.18 },
                EffectsValues { reverb: 0.14, delay: 0.0, distortion: 0.1, volume: 0.7 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 5_200.0,
                    filter_resonance: 1.2,
                    unison_voices: 2,
                    unison_detune: 12.0,
                    ..EngineValues::default()
                },
                "Fast and focused with a little heat. Good for ostinati, hooks, and rhythmic figures.",
            ),
        );

        initial_presets.insert(
            "dusty_tape".to_string(),
            system_preset(
                "Dusty Tape",
                "Square",
                ADSRValues { attack: 0.03, decay: 0.2, sustain: 0.54, release: 0.88 },
                EffectsValues { reverb: 0.34, delay: 164.0, distortion: 0.07, volume: 0.57 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 7_600.0,
                    filter_resonance: 0.9,
                    lfo_rate: 0.19,
                    lfo_depth: 0.05,
                    lfo_target: 1,
                    ..EngineValues::default()
                },
                "Softly degraded, slightly unstable, and better suited to atmosphere than clean fidelity.",
            ),
        );

        initial_presets.insert(
            "analog_bass".to_string(),
            system_preset(
                "Analog Bass",
                "Sawtooth",
                ADSRValues { attack: 0.006, decay: 0.11, sustain: 0.62, release: 0.24 },
                EffectsValues { reverb: 0.02, delay: 0.0, distortion: 0.13, volume: 0.72 },
                EngineValues {
                    use_filter: true,
                    filter_cutoff: 2_400.0,
                    filter_resonance: 1.5,
                    ..EngineValues::default()
                },
                "Round low-end with enough drive to hold the center without eating the mix.",
            ),
        );

        PresetStore {
            presets: Arc::new(RwLock::new(initial_presets)),
        }
    }
}

#[derive(Serialize)]
struct StatusResponse {
    server: &'static str,
    status: &'static str,
    version: &'static str,
    features: Vec<&'static str>,
    uptime_seconds: u64,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

#[get("/status")]
fn status() -> Json<StatusResponse> {
    let start_time = START_TIME.get_or_init(|| std::time::Instant::now());
    let uptime = start_time.elapsed().as_secs();
    
    Json(StatusResponse {
        server: "Vangelis-Backend",
        status: "OK",
        version: "1.0.0",
        features: vec![
            "AudioWorklet Synth Engine",
            "Preset Management",
            "Real-time Synthesis",
            "Multi-mode Filters",
            "LFO Modulation",
            "Curated Performance Presets",
        ],
        uptime_seconds: uptime,
    })
}

#[get("/presets")]
async fn list_presets(store: &State<PresetStore>) -> Json<ApiResponse<Vec<Preset>>> {
    let presets = store.presets.read().await;
    let preset_list: Vec<Preset> = presets.values().cloned().collect();
    
    Json(ApiResponse {
        success: true,
        data: Some(preset_list),
        error: None,
    })
}

#[get("/presets/<name>")]
async fn get_preset(name: &str, store: &State<PresetStore>) -> Json<ApiResponse<Preset>> {
    let presets = store.presets.read().await;
    
    match presets.get(name) {
        Some(preset) => Json(ApiResponse {
            success: true,
            data: Some(preset.clone()),
            error: None,
        }),
        None => Json(ApiResponse {
            success: false,
            data: None,
            error: Some(format!("Preset '{}' not found", name)),
        }),
    }
}

#[post("/presets", data = "<preset>")]
async fn save_preset(
    preset: Json<Preset>,
    store: &State<PresetStore>,
) -> Json<ApiResponse<String>> {
    let mut presets = store.presets.write().await;
    
    let key = preset.name.to_lowercase().replace(" ", "_");
    let mut new_preset = preset.into_inner();
    new_preset.created_at = default_timestamp();
    
    presets.insert(key.clone(), new_preset);
    
    Json(ApiResponse {
        success: true,
        data: Some(key),
        error: None,
    })
}

#[delete("/presets/<name>")]
async fn delete_preset(
    name: &str,
    store: &State<PresetStore>,
) -> Json<ApiResponse<String>> {
    let mut presets = store.presets.write().await;
    
    // Prevent deletion of system presets
    if SYSTEM_PRESET_KEYS.contains(&name) {
        return Json(ApiResponse {
            success: false,
            data: None,
            error: Some("Cannot delete system presets".to_string()),
        });
    }
    
    match presets.remove(name) {
        Some(_) => Json(ApiResponse {
            success: true,
            data: Some(format!("Preset '{}' deleted", name)),
            error: None,
        }),
        None => Json(ApiResponse {
            success: false,
            data: None,
            error: Some(format!("Preset '{}' not found", name)),
        }),
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", FileServer::from(relative!("../frontend/dist")))
        .mount("/api", routes![
            status,
            list_presets,
            get_preset,
            save_preset,
            delete_preset,
        ])
        .manage(PresetStore::new())
}
