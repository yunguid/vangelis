use wasm_bindgen::prelude::*;

pub trait AudioProcessor {
    fn process(&mut self, input: &mut [f32], sample_rate: f32);
}

#[wasm_bindgen]
pub struct DSPChain {
    processors: Vec<Box<dyn AudioProcessor>>,
}

#[wasm_bindgen]
impl DSPChain {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        DSPChain {
            processors: Vec::new(),
        }
    }

    pub fn process(&mut self, samples: &mut [f32], sample_rate: f32) {
        for processor in self.processors.iter_mut() {
            processor.process(samples, sample_rate);
        }
    }
}

// Internal implementation for managing processors
impl DSPChain {
    pub fn add_processor(&mut self, processor: Box<dyn AudioProcessor>) {
        self.processors.push(processor);
    }
}

// Simple gain processor
pub struct GainProcessor {
    gain: f32,
}

impl GainProcessor {
    pub fn new(gain: f32) -> Self {
        GainProcessor { gain }
    }
}

impl AudioProcessor for GainProcessor {
    fn process(&mut self, input: &mut [f32], _sample_rate: f32) {
        for sample in input.iter_mut() {
            *sample *= self.gain;
        }
    }
}

// Simple low-pass filter
pub struct LowPassFilter {
    cutoff: f32,
    resonance: f32,
    prev_input: f32,
    prev_output: f32,
}

impl LowPassFilter {
    pub fn new(cutoff: f32, resonance: f32) -> Self {
        LowPassFilter {
            cutoff,
            resonance,
            prev_input: 0.0,
            prev_output: 0.0,
        }
    }
}

impl AudioProcessor for LowPassFilter {
    fn process(&mut self, input: &mut [f32], sample_rate: f32) {
        // One-pole low-pass filter with resonance
        let dt = 1.0 / sample_rate;
        let rc = 1.0 / (2.0 * std::f32::consts::PI * self.cutoff);
        let alpha = dt / (rc + dt);
        
        // Apply resonance as feedback gain
        let feedback = self.resonance.min(0.95); // Limit to avoid instability
        
        for sample in input.iter_mut() {
            // Add resonance feedback
            let input_with_feedback = *sample + feedback * self.prev_output;
            
            // Apply filter
            self.prev_output = self.prev_output + alpha * (input_with_feedback - self.prev_output);
            self.prev_input = *sample;
            *sample = self.prev_output;
        }
    }
} 