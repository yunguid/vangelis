use wasm_bindgen::prelude::*;

mod waveforms;
mod utils;
mod envelope;
mod dsp;
mod lfo;
mod filter;

use waveforms::{Waveform, generate_waveform, generate_waveform_with_phase, fm_waveform, fm_waveform_parallel, parallel_generate_waveform, pan_stereo};
use utils::set_panic_hook;
use envelope::{ADSR, apply_adsr};
pub use dsp::{DSPChain, AudioProcessor, GainProcessor, LowPassFilter};
pub use lfo::{LFO, LFOTarget, apply_lfo_amplitude, wasm_apply_lfo_amplitude};
pub use filter::{StateVariableFilter, FilterMode, OnePoleFilter, wasm_apply_filter};

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

#[wasm_bindgen]
pub fn wasm_generate_waveform_with_phase(waveform: WasmWaveform, freq: f32, phase_offset: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    set_panic_hook();
    let waveform = match waveform {
        WasmWaveform::Sine => Waveform::Sine,
        WasmWaveform::Sawtooth => Waveform::Sawtooth,
        WasmWaveform::Square => Waveform::Square,
        WasmWaveform::Triangle => Waveform::Triangle,
    };
    generate_waveform_with_phase(waveform, freq, phase_offset, duration_secs, sample_rate)
}

#[wasm_bindgen]
pub fn wasm_parallel_generate_waveform(waveform: WasmWaveform, freq: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    set_panic_hook();
    let waveform = match waveform {
        WasmWaveform::Sine => Waveform::Sine,
        WasmWaveform::Sawtooth => Waveform::Sawtooth,
        WasmWaveform::Square => Waveform::Square,
        WasmWaveform::Triangle => Waveform::Triangle,
    };
    parallel_generate_waveform(waveform, freq, duration_secs, sample_rate)
}

#[wasm_bindgen]
pub fn wasm_fm_waveform(carrier_freq: f32, modulator_freq: f32, modulation_index: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    set_panic_hook();
    fm_waveform(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate)
}

#[wasm_bindgen]
pub fn wasm_fm_waveform_parallel(carrier_freq: f32, modulator_freq: f32, modulation_index: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    set_panic_hook();
    fm_waveform_parallel(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate)
}

#[wasm_bindgen]
pub fn wasm_apply_adsr(samples: &mut [f32], attack: f32, decay: f32, sustain: f32, release: f32, sample_rate: f32) {
    set_panic_hook();
    let adsr = ADSR::new(attack, decay, sustain, release);
    apply_adsr(samples, &adsr, sample_rate);
}

#[wasm_bindgen]
pub fn wasm_pan_stereo(samples: &[f32], pan: f32) -> Vec<f32> {
    set_panic_hook();
    let stereo_samples = pan_stereo(samples, pan);
    // Flatten the stereo samples into a single array with alternating left/right samples
    let mut result = Vec::with_capacity(stereo_samples.len() * 2);
    for (left, right) in stereo_samples {
        result.push(left);
        result.push(right);
    }
    result
}