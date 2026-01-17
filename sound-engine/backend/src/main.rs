#[macro_use] extern crate rocket;

use rocket::fs::{FileServer, relative};
use rocket::serde::json::Json;
use rocket::serde::{Serialize, Deserialize};
use rocket::{State, http::Status as HttpStatus};
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
struct Preset {
    name: String,
    waveform: String,
    adsr: ADSRValues,
    effects: EffectsValues,
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

impl PresetStore {
    fn new() -> Self {
        let mut initial_presets = HashMap::new();
        
        // Add some default presets
        initial_presets.insert(
            "default".to_string(),
            Preset {
                name: "Default".to_string(),
                waveform: "Sine".to_string(),
                adsr: ADSRValues {
                    attack: 0.05,
                    decay: 0.1,
                    sustain: 0.7,
                    release: 0.3,
                },
                effects: EffectsValues {
                    reverb: 0.0,
                    delay: 0.0,
                    distortion: 0.0,
                    volume: 0.7,
                },
                author: "System".to_string(),
                description: "Clean default sound".to_string(),
                created_at: default_timestamp(),
            },
        );
        
        initial_presets.insert(
            "pad".to_string(),
            Preset {
                name: "Ambient Pad".to_string(),
                waveform: "Triangle".to_string(),
                adsr: ADSRValues {
                    attack: 0.8,
                    decay: 0.3,
                    sustain: 0.6,
                    release: 1.2,
                },
                effects: EffectsValues {
                    reverb: 0.7,
                    delay: 200.0,
                    distortion: 0.0,
                    volume: 0.5,
                },
                author: "System".to_string(),
                description: "Lush ambient pad with reverb".to_string(),
                created_at: default_timestamp(),
            },
        );
        
        // Curated musical presets
        initial_presets.insert(
            "warm_pad".to_string(),
            Preset {
                name: "Warm Pad".to_string(),
                waveform: "Triangle".to_string(),
                adsr: ADSRValues {
                    attack: 0.6,
                    decay: 0.25,
                    sustain: 0.7,
                    release: 1.5,
                },
                effects: EffectsValues {
                    reverb: 0.6,
                    delay: 180.0,
                    distortion: 0.0,
                    volume: 0.55,
                },
                author: "System".to_string(),
                description: "Gentle, lush pad with bloom and width".to_string(),
                created_at: default_timestamp(),
            },
        );

        initial_presets.insert(
            "glass_keys".to_string(),
            Preset {
                name: "Glass Keys".to_string(),
                waveform: "Sine".to_string(),
                adsr: ADSRValues {
                    attack: 0.02,
                    decay: 0.2,
                    sustain: 0.5,
                    release: 0.45,
                },
                effects: EffectsValues {
                    reverb: 0.35,
                    delay: 120.0,
                    distortion: 0.0,
                    volume: 0.6,
                },
                author: "System".to_string(),
                description: "Shimmering bell-like keys with space".to_string(),
                created_at: default_timestamp(),
            },
        );

        initial_presets.insert(
            "soft_ep".to_string(),
            Preset {
                name: "Soft EP".to_string(),
                waveform: "Triangle".to_string(),
                adsr: ADSRValues {
                    attack: 0.01,
                    decay: 0.3,
                    sustain: 0.4,
                    release: 0.6,
                },
                effects: EffectsValues {
                    reverb: 0.25,
                    delay: 90.0,
                    distortion: 0.0,
                    volume: 0.6,
                },
                author: "System".to_string(),
                description: "Mellow electric piano vibe".to_string(),
                created_at: default_timestamp(),
            },
        );

        initial_presets.insert(
            "lofi_tape".to_string(),
            Preset {
                name: "LoFi Tape".to_string(),
                waveform: "Square".to_string(),
                adsr: ADSRValues {
                    attack: 0.03,
                    decay: 0.2,
                    sustain: 0.5,
                    release: 0.8,
                },
                effects: EffectsValues {
                    reverb: 0.4,
                    delay: 180.0,
                    distortion: 0.05,
                    volume: 0.5,
                },
                author: "System".to_string(),
                description: "Slight grit with cozy ambience".to_string(),
                created_at: default_timestamp(),
            },
        );

        initial_presets.insert(
            "analog_bass".to_string(),
            Preset {
                name: "Analog Bass".to_string(),
                waveform: "Sawtooth".to_string(),
                adsr: ADSRValues {
                    attack: 0.0,
                    decay: 0.12,
                    sustain: 0.7,
                    release: 0.2,
                },
                effects: EffectsValues {
                    reverb: 0.0,
                    delay: 0.0,
                    distortion: 0.1,
                    volume: 0.7,
                },
                author: "System".to_string(),
                description: "Rounded classic subtractive bass".to_string(),
                created_at: default_timestamp(),
            },
        );

        initial_presets.insert(
            "pluck".to_string(),
            Preset {
                name: "Pluck".to_string(),
                waveform: "Sawtooth".to_string(),
                adsr: ADSRValues {
                    attack: 0.01,
                    decay: 0.15,
                    sustain: 0.2,
                    release: 0.1,
                },
                effects: EffectsValues {
                    reverb: 0.2,
                    delay: 0.0,
                    distortion: 0.0,
                    volume: 0.7,
                },
                author: "System".to_string(),
                description: "Sharp plucked sound".to_string(),
                created_at: default_timestamp(),
            },
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
    if matches!(name, 
        "default" | 
        "pad" | 
        "pluck" | 
        "warm_pad" | 
        "glass_keys" | 
        "soft_ep" | 
        "lofi_tape" | 
        "analog_bass"
    ) {
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
