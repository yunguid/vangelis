use wasm_bindgen::prelude::*;
use std::f32::consts::PI;

#[wasm_bindgen]
pub enum Waveform {
    Sine,
    Sawtooth,
}

#[wasm_bindgen]
pub fn generate_waveform(waveform: Waveform, freq: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    let sample_count = (duration_secs * sample_rate) as usize;
    match waveform {
        Waveform::Sine => (0..sample_count)
            .map(|n| {
                let t = n as f32 / sample_rate;
                (2.0 * PI * freq * t).sin()
            })
            .collect(),
        Waveform::Sawtooth => (0..sample_count)
            .map(|n| {
                let t = n as f32 / sample_rate;
                2.0 * (t * freq - (t * freq + 0.5).floor())
            })
            .collect(),
    }
}
