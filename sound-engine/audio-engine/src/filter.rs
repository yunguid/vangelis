use wasm_bindgen::prelude::*;
use std::f32::consts::PI;

/// Filter mode for state-variable filter
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FilterMode {
    LowPass,
    HighPass,
    BandPass,
    Notch,
}

/// State-variable filter with multiple modes
///
/// This is a versatile 2-pole filter that can operate in multiple modes
/// with resonance control.
#[wasm_bindgen]
pub struct StateVariableFilter {
    cutoff: f32,
    resonance: f32,
    mode: FilterMode,
    // Internal state variables
    lp: f32,  // Low-pass output
    bp: f32,  // Band-pass output
}

#[wasm_bindgen]
impl StateVariableFilter {
    #[wasm_bindgen(constructor)]
    pub fn new(cutoff: f32, resonance: f32, mode: FilterMode) -> Self {
        StateVariableFilter {
            cutoff: cutoff.max(20.0).min(20000.0),
            resonance: resonance.max(0.1).min(10.0),
            mode,
            lp: 0.0,
            bp: 0.0,
        }
    }

    pub fn set_cutoff(&mut self, cutoff: f32) {
        self.cutoff = cutoff.max(20.0).min(20000.0);
    }

    pub fn set_resonance(&mut self, resonance: f32) {
        self.resonance = resonance.max(0.1).min(10.0);
    }

    pub fn set_mode(&mut self, mode: FilterMode) {
        self.mode = mode;
    }

    pub fn reset(&mut self) {
        self.lp = 0.0;
        self.bp = 0.0;
    }

    /// Process a single sample
    pub fn process_sample(&mut self, input: f32, sample_rate: f32) -> f32 {
        // Calculate filter coefficients
        let f = 2.0 * (PI * self.cutoff / sample_rate).sin();
        let q = 1.0 / self.resonance;
        
        // State-variable filter equations
        self.lp = self.lp + f * self.bp;
        let hp = input - self.lp - q * self.bp;
        self.bp = self.bp + f * hp;
        
        // Select output based on mode
        match self.mode {
            FilterMode::LowPass => self.lp,
            FilterMode::HighPass => hp,
            FilterMode::BandPass => self.bp,
            FilterMode::Notch => input - q * self.bp,
        }
    }

    /// Process a buffer of samples
    pub fn process_buffer(&mut self, samples: &mut [f32], sample_rate: f32) {
        for sample in samples.iter_mut() {
            *sample = self.process_sample(*sample, sample_rate);
        }
    }
}

/// Simple one-pole low-pass filter (faster, but less steep)
#[wasm_bindgen]
pub struct OnePoleFilter {
    cutoff: f32,
    state: f32,
}

#[wasm_bindgen]
impl OnePoleFilter {
    #[wasm_bindgen(constructor)]
    pub fn new(cutoff: f32) -> Self {
        OnePoleFilter {
            cutoff: cutoff.max(20.0).min(20000.0),
            state: 0.0,
        }
    }

    pub fn set_cutoff(&mut self, cutoff: f32) {
        self.cutoff = cutoff.max(20.0).min(20000.0);
    }

    pub fn reset(&mut self) {
        self.state = 0.0;
    }

    pub fn process_sample(&mut self, input: f32, sample_rate: f32) -> f32 {
        let rc = 1.0 / (2.0 * PI * self.cutoff);
        let dt = 1.0 / sample_rate;
        let alpha = dt / (rc + dt);
        
        self.state = self.state + alpha * (input - self.state);
        self.state
    }

    pub fn process_buffer(&mut self, samples: &mut [f32], sample_rate: f32) {
        for sample in samples.iter_mut() {
            *sample = self.process_sample(*sample, sample_rate);
        }
    }
}

/// WASM-exposed filter processing function
#[wasm_bindgen]
pub fn wasm_apply_filter(
    samples: &mut [f32],
    cutoff: f32,
    resonance: f32,
    mode: FilterMode,
    sample_rate: f32
) {
    let mut filter = StateVariableFilter::new(cutoff, resonance, mode);
    filter.process_buffer(samples, sample_rate);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lowpass_attenuates_high_frequencies() {
        let mut filter = StateVariableFilter::new(1000.0, 1.0, FilterMode::LowPass);
        
        // Generate high-frequency signal (5kHz)
        let sample_rate = 44100.0;
        let mut samples: Vec<f32> = (0..1000)
            .map(|i| {
                let t = i as f32 / sample_rate;
                (2.0 * PI * 5000.0 * t).sin()
            })
            .collect();
        
        filter.process_buffer(&mut samples, sample_rate);
        
        // Output should be significantly attenuated
        let rms_out: f32 = samples.iter().map(|&s| s * s).sum::<f32>() / samples.len() as f32;
        let rms_out = rms_out.sqrt();
        
        assert!(rms_out < 0.5, "Low-pass filter should attenuate high frequencies");
    }

    #[test]
    fn test_highpass_attenuates_low_frequencies() {
        let mut filter = StateVariableFilter::new(1000.0, 1.0, FilterMode::HighPass);
        
        // Generate low-frequency signal (100Hz)
        let sample_rate = 44100.0;
        let mut samples: Vec<f32> = (0..1000)
            .map(|i| {
                let t = i as f32 / sample_rate;
                (2.0 * PI * 100.0 * t).sin()
            })
            .collect();
        
        filter.process_buffer(&mut samples, sample_rate);
        
        // Output should be significantly attenuated
        let rms_out: f32 = samples.iter().map(|&s| s * s).sum::<f32>() / samples.len() as f32;
        let rms_out = rms_out.sqrt();
        
        assert!(rms_out < 0.5, "High-pass filter should attenuate low frequencies");
    }

    #[test]
    fn test_filter_stability() {
        let mut filter = StateVariableFilter::new(1000.0, 5.0, FilterMode::LowPass);
        let sample_rate = 44100.0;
        
        // Process many samples with high resonance
        for _ in 0..10000 {
            let output = filter.process_sample(1.0, sample_rate);
            assert!(!output.is_nan(), "Filter became unstable");
            assert!(output.abs() < 100.0, "Filter output exploded");
        }
    }
}


