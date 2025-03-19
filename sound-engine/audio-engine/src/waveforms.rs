use std::f32::consts::PI;
use rayon::prelude::*;

#[derive(Debug, Clone, Copy)]
pub enum Waveform {
    Sine,
    Sawtooth,
    Square,
    Triangle,
}

#[inline(always)]
fn sine_wave_sample(freq: f32, phase: f32, t: f32) -> f32 {
    (2.0 * PI * freq * t + phase).sin()
}

#[inline(always)]
fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let t = t / dt;
        return 2.0 * t - t * t - 1.0;
    } else if t > 1.0 - dt {
        let t = (t - 1.0) / dt;
        return t * t + 2.0 * t + 1.0;
    } else {
        return 0.0;
    }
}

pub fn generate_waveform(waveform: Waveform, freq: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    generate_waveform_with_phase(waveform, freq, 0.0, duration_secs, sample_rate)
}

pub fn generate_waveform_with_phase(waveform: Waveform, freq: f32, phase_offset: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    let sample_count = (duration_secs * sample_rate) as usize;
    match waveform {
        Waveform::Sine => (0..sample_count)
            .map(|n| {
                let t = n as f32 / sample_rate;
                sine_wave_sample(freq, phase_offset, t)
            })
            .collect(),
        Waveform::Sawtooth => {
            let dt = freq / sample_rate;
            (0..sample_count)
                .map(|n| {
                    let t = n as f32 / sample_rate;
                    let phase = (freq * t + phase_offset / (2.0 * PI)).fract();
                    let saw = 2.0 * phase - 1.0;
                    // Apply PolyBLEP anti-aliasing
                    saw - poly_blep(phase, dt)
                })
                .collect()
        },
        Waveform::Square => {
            let dt = freq / sample_rate;
            (0..sample_count)
                .map(|n| {
                    let t = n as f32 / sample_rate;
                    let phase = (freq * t + phase_offset / (2.0 * PI)).fract();
                    let square = if phase < 0.5 { 1.0 } else { -1.0 };
                    // Apply PolyBLEP anti-aliasing
                    square + poly_blep(phase, dt) - poly_blep((phase + 0.5).fract(), dt)
                })
                .collect()
        },
        Waveform::Triangle => {
            let _dt = freq / sample_rate;
            (0..sample_count)
                .map(|n| {
                    let t = n as f32 / sample_rate;
                    let phase = (freq * t + phase_offset / (2.0 * PI)).fract();
                    // Triangle is less susceptible to aliasing, but can still benefit from filtering
                    let triangle = 2.0 * (2.0 * phase - 1.0).abs() - 1.0;
                    triangle
                })
                .collect()
        },
    }
}

pub fn parallel_generate_waveform(waveform: Waveform, freq: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    let sample_count = (duration_secs * sample_rate) as usize;
    (0..sample_count).into_par_iter().map(|n| {
        let t = n as f32 / sample_rate;
        match waveform {
            Waveform::Sine => sine_wave_sample(freq, 0.0, t),
            Waveform::Sawtooth => {
                let dt = freq / sample_rate;
                let phase = (freq * t).fract();
                let saw = 2.0 * phase - 1.0;
                saw - poly_blep(phase, dt)
            },
            Waveform::Square => {
                let dt = freq / sample_rate;
                let phase = (freq * t).fract();
                let square = if phase < 0.5 { 1.0 } else { -1.0 };
                square + poly_blep(phase, dt) - poly_blep((phase + 0.5).fract(), dt)
            },
            Waveform::Triangle => {
                let phase = (freq * t).fract();
                2.0 * (2.0 * phase - 1.0).abs() - 1.0
            },
        }
    }).collect()
}

pub fn fm_waveform(carrier_freq: f32, modulator_freq: f32, modulation_index: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    let sample_count = (duration_secs * sample_rate) as usize;
    (0..sample_count).map(|n| {
        let t = n as f32 / sample_rate;
        (2.0 * PI * carrier_freq * t + modulation_index * (2.0 * PI * modulator_freq * t).sin()).sin()
    }).collect()
}

pub fn fm_waveform_parallel(carrier_freq: f32, modulator_freq: f32, modulation_index: f32, duration_secs: f32, sample_rate: f32) -> Vec<f32> {
    let sample_count = (duration_secs * sample_rate) as usize;
    (0..sample_count).into_par_iter().map(|n| {
        let t = n as f32 / sample_rate;
        (2.0 * PI * carrier_freq * t + modulation_index * (2.0 * PI * modulator_freq * t).sin()).sin()
    }).collect()
}

pub fn pan_stereo(mono_samples: &[f32], pan: f32) -> Vec<(f32, f32)> {
    let pan = pan.max(0.0).min(1.0);
    mono_samples.iter().map(|&s| {
        let left = s * (1.0 - pan).sqrt();
        let right = s * pan.sqrt();
        (left, right)
    }).collect()
}
