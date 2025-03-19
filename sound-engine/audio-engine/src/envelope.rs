use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct ADSR {
    pub attack: f32,
    pub decay: f32,
    pub sustain: f32,
    pub release: f32,
}

#[wasm_bindgen]
impl ADSR {
    #[wasm_bindgen(constructor)]
    pub fn new(attack: f32, decay: f32, sustain: f32, release: f32) -> Self {
        ADSR {
            attack,
            decay,
            sustain,
            release,
        }
    }

    pub fn default() -> Self {
        ADSR {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.2,
        }
    }
}

pub fn apply_adsr(samples: &mut [f32], adsr: &ADSR, sample_rate: f32) {
    let total_samples = samples.len();
    let attack_samples = (adsr.attack * sample_rate) as usize;
    let decay_samples = (adsr.decay * sample_rate) as usize;
    let release_samples = (adsr.release * sample_rate) as usize;
    let sustain_samples = total_samples.saturating_sub(attack_samples + decay_samples + release_samples);

    for (i, sample) in samples.iter_mut().enumerate() {
        let amplitude = if i < attack_samples {
            (i as f32) / (attack_samples.max(1) as f32) // linear attack
        } else if i < attack_samples + decay_samples {
            1.0 - ((1.0 - adsr.sustain) * (i - attack_samples) as f32 / decay_samples.max(1) as f32)
        } else if i < attack_samples + decay_samples + sustain_samples {
            adsr.sustain
        } else {
            adsr.sustain * (1.0 - ((i - attack_samples - decay_samples - sustain_samples) as f32 / release_samples.max(1) as f32))
        };
        *sample *= amplitude.max(0.0).min(1.0);
    }
}
