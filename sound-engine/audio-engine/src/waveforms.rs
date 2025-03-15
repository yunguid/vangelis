use std::f32::consts::PI;

pub enum Waveform {
    Sine,
    Sawtooth,
    Square,
    Triangle,
}

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
        Waveform::Square => (0..sample_count)
            .map(|n| {
                let t = n as f32 / sample_rate;
                if (t * freq).fract() < 0.5 { 1.0 } else { -1.0 }
            })
            .collect(),
        Waveform::Triangle => (0..sample_count)
            .map(|n| {
                let t = n as f32 / sample_rate;
                2.0 * (2.0 * (t * freq - (t * freq + 0.5).floor())).abs() - 1.0
            })
            .collect(),
    }
}
