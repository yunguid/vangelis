use wasm_bindgen::prelude::*;
use crate::waveforms::{Waveform, generate_waveform};

/// LFO (Low Frequency Oscillator) target parameters
#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub enum LFOTarget {
    Pitch,
    Amplitude,
    FilterCutoff,
    Pan,
}

/// LFO configuration
#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct LFO {
    rate: f32,        // Hz (typically 0.1 - 20 Hz)
    depth: f32,       // 0.0-1.0
    waveform: Waveform,
    target: LFOTarget,
}

#[wasm_bindgen]
impl LFO {
    #[wasm_bindgen(constructor)]
    pub fn new(rate: f32, depth: f32, waveform: Waveform, target: LFOTarget) -> Self {
        LFO {
            rate: rate.max(0.01).min(50.0),
            depth: depth.max(0.0).min(1.0),
            waveform,
            target,
        }
    }

    pub fn default_vibrato() -> Self {
        LFO {
            rate: 5.0,
            depth: 0.05,
            waveform: Waveform::Sine,
            target: LFOTarget::Pitch,
        }
    }

    pub fn default_tremolo() -> Self {
        LFO {
            rate: 6.0,
            depth: 0.3,
            waveform: Waveform::Sine,
            target: LFOTarget::Amplitude,
        }
    }
}

/// Apply LFO modulation to audio samples
///
/// # Arguments
/// * `samples` - Audio samples to modulate
/// * `lfo` - LFO configuration
/// * `sample_rate` - Sample rate in Hz
pub fn apply_lfo_amplitude(samples: &mut [f32], lfo: &LFO, sample_rate: f32) {
    let duration = samples.len() as f32 / sample_rate;
    let lfo_samples = generate_waveform(lfo.waveform, lfo.rate, duration, sample_rate);
    
    for (i, sample) in samples.iter_mut().enumerate() {
        if i < lfo_samples.len() {
            // Map LFO from [-1, 1] to [1-depth, 1+depth]
            let mod_value = lfo_samples[i] * lfo.depth;
            *sample *= 1.0 + mod_value;
        }
    }
}

/// Generate pitch modulation curve from LFO
///
/// Returns a curve of frequency multipliers
pub fn generate_lfo_pitch_curve(lfo: &LFO, duration: f32, sample_rate: f32) -> Vec<f32> {
    let lfo_samples = generate_waveform(lfo.waveform, lfo.rate, duration, sample_rate);
    
    lfo_samples
        .iter()
        .map(|&lfo_val| {
            // Convert LFO value to pitch multiplier (semitones)
            let semitones = lfo_val * lfo.depth * 2.0; // +/- 2 semitones max
            2.0f32.powf(semitones / 12.0)
        })
        .collect()
}

#[wasm_bindgen]
pub fn wasm_apply_lfo_amplitude(
    samples: &mut [f32],
    rate: f32,
    depth: f32,
    waveform: u32,
    sample_rate: f32
) {
    let wf = match waveform {
        0 => Waveform::Sine,
        1 => Waveform::Sawtooth,
        2 => Waveform::Square,
        3 => Waveform::Triangle,
        _ => Waveform::Sine,
    };
    
    let lfo = LFO::new(rate, depth, wf, LFOTarget::Amplitude);
    apply_lfo_amplitude(samples, &lfo, sample_rate);
}


