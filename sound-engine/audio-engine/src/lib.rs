use wasm_bindgen::prelude::*;

mod waveforms;
mod utils;

use waveforms::{Waveform, generate_waveform};
use utils::set_panic_hook;

#[wasm_bindgen]
pub enum WasmWaveform {
    Sine, 
    Sawtooth,
    Square,
    Triangle,
}

#[wasm_bindgen]
pub fn wasm_generate_waveform(waveform: WasmWaveform, freq: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    set_panic_hook();
    let waveform = match waveform {
        WasmWaveform::Sine => Waveform::Sine,
        WasmWaveform::Sawtooth => Waveform::Sawtooth,
        WasmWaveform::Square => Waveform::Square,
        WasmWaveform::Triangle => Waveform::Triangle,
    };
    generate_waveform(waveform, freq, duration_secs, sample_rate)
}