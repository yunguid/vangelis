# Audio Resources & Rust DSP Learning Guide

A comprehensive guide for enhancing your Vangelis web synthesizer, plus deep-dive explanations of the Rust audio engine code.

---

## Part 1: Open Source Resources & Enhancement Ideas

### Web Audio + Rust/WASM Projects

These projects can serve as inspiration or direct resources for enhancing Vangelis:

| Project | Description | Link |
|---------|-------------|------|
| **Wavetable Synth** | Full wavetable synthesizer in Rust/WASM with excellent performance | [cprimozic.net](https://cprimozic.net/blog/buliding-a-wavetable-synthesizer-with-rust-wasm-and-webaudio/) |
| **FM Synth** | FM synthesis with WASM SIMD for CPU optimization | [cprimozic.net](https://cprimozic.net/blog/fm-synth-rust-wasm-simd/) |
| **Ruffbox** | Multi-threaded sampler/synth with AudioWorklet | [GitHub](https://github.com/the-drunk-coder/ruffbox) |
| **web-audio-api-rs** | Full Rust Web Audio API implementation | [GitHub](https://github.com/orottier/web-audio-api-rs) |
| **Clawdio** | Web Audio worklet library processing audio via Rust/WASM | [whoisryosuke.com](https://whoisryosuke.com/blog/2025/web-audio-effect-library-with-rust-and-wasm) |

### Rust Audio Crates

These crates can be compiled to WASM and used to enhance your audio engine:

| Crate | Use Case | Link |
|-------|----------|------|
| **FunDSP** | Comprehensive DSP with signal flow analysis and composable audio graphs | [lib.rs](https://lib.rs/crates/fundsp) |
| **synfx-dsp** | Real-time synthesis algorithms (from HexoSynth) | [docs.rs](https://docs.rs/synfx-dsp) |
| **synfx-dsp-jit** | JIT-compiled DSP for maximum performance | [lib.rs](https://lib.rs/crates/synfx-dsp-jit) |
| **Phonic** | Cross-platform audio with built-in effects (reverb, chorus, EQ, compressor) | [crates.io](https://crates.io/crates/phonic) |
| **Twang** | Pure Rust synthesis with oscillators and effects | [docs.rs](https://docs.rs/twang) |

### JavaScript DSP Libraries

For effects that don't need WASM performance:

| Library | Features | Link |
|---------|----------|------|
| **Pizzicato.js** | Delay, Reverb, Distortion, Flanger, Tremolo, Ring Modulator, Filters | [alemangui.github.io](https://alemangui.github.io/pizzicato/) |
| **Essentia.js** | Music/audio analysis (FFT, beat detection, pitch tracking) via WASM | [mtg.github.io](https://mtg.github.io/essentia.js/) |
| **Tone.js** | Full-featured music framework with synths and effects | [tonejs.github.io](https://tonejs.github.io/) |
| **DSP.js** | Oscillators, FFT, filters, envelopes | Classic library |

**Curated Resource**: [Awesome WebAudio](https://github.com/notthetup/awesome-webaudio) - maintained list of WebAudio packages

### Free Sample Libraries (Creative Commons)

For expanding your sample collection:

| Source | License | Content |
|--------|---------|---------|
| **Freesound** | CC-BY/CC0 | 120,000+ sounds, collaborative database | [freesound.org](https://freesound.org/) |
| **Spitfire LABS** | Free | Soft piano, drums, strings, unique textures | [labs.spitfireaudio.com](https://labs.spitfireaudio.com/) |
| **Pianobook** | Free | Community-sampled instruments | [pianobook.co.uk](https://www.pianobook.co.uk/) |
| **Versilian Studios** | CC0 | Strings, piano, percussion (public domain) | [vis.versilstudios.com](https://vis.versilstudios.com/) |
| **OLPC Sound Library** | CC-BY | 8.5GB from Berklee College of Music | [archive.org](https://archive.org/) |

---

## Part 2: Understanding Your Rust Audio Engine

Your audio engine is well-structured with clear separation of concerns. Let's break down each component.

### Overview: The Module Structure

```
audio-engine/src/
├── lib.rs        # Entry point, WASM bindings
├── waveforms.rs  # Oscillator generation with PolyBLEP
├── envelope.rs   # ADSR amplitude shaping
├── filter.rs     # State-variable and one-pole filters
├── lfo.rs        # Low-frequency oscillators for modulation
├── dsp.rs        # DSP chain and processors
└── utils.rs      # Panic hook for better errors
```

---

### Waveform Generation (`waveforms.rs`)

#### The Fundamental Math: Digital Oscillators

Every sound starts as a waveform. Your synth generates these mathematically:

**Sine Wave** - The purest tone, a single frequency with no harmonics:

```rust
fn sine_wave_sample(freq: f32, phase: f32, t: f32) -> f32 {
    (2.0 * PI * freq * t + phase).sin()
}
```

**The equation**: `sin(2πft + φ)`
- `f` = frequency (Hz) - how many cycles per second
- `t` = time (seconds) - current position
- `φ` (phase) = starting offset in radians

**Visual intuition**: Imagine a point rotating around a circle. The sine value is its height above center at time `t`.

```
         1.0  ●────────────●
              /              \
         0.0 ●                ●────────────●
              \              /
        -1.0  ●────────────●

              0   π/2   π  3π/2  2π
```

#### Sawtooth, Square, and Triangle Waves

**Sawtooth** - Ramps up linearly, then jumps down:
```rust
let phase = (freq * t).fract();  // 0.0 to 1.0 repeating
let saw = 2.0 * phase - 1.0;     // Map to -1.0 to 1.0
```

**Square** - Alternates between +1 and -1:
```rust
let square = if phase < 0.5 { 1.0 } else { -1.0 };
```

**Triangle** - Linear ramp up, then linear ramp down:
```rust
let triangle = 2.0 * (2.0 * phase - 1.0).abs() - 1.0;
```

The `abs()` creates the "fold" at the peak.

#### The Aliasing Problem

Digital audio has a fundamental limit called the **Nyquist frequency** (half the sample rate). When you generate a sawtooth or square wave with sharp edges (discontinuities), you're theoretically creating infinite harmonics. Harmonics above Nyquist "fold back" into the audible range as ugly artifacts called **aliasing**.

```
ALIASING EXAMPLE (at 44100 Hz sample rate):
Nyquist = 22050 Hz

If your square wave at 5000 Hz has harmonics at:
  5000, 15000, 25000, 35000 Hz...
                ↓         ↓
The 25000 Hz reflects to → 19100 Hz (aliased!)
The 35000 Hz reflects to → 9100 Hz  (aliased!)

Result: Inharmonic "digital" harshness
```

#### PolyBLEP: Elegant Anti-Aliasing

Your code uses **PolyBLEP** (Polynomial Band-Limited Step) to smooth out discontinuities:

```rust
fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        // Just after discontinuity
        let t = t / dt;
        return 2.0 * t - t * t - 1.0;
    } else if t > 1.0 - dt {
        // Just before discontinuity
        let t = (t - 1.0) / dt;
        return t * t + 2.0 * t + 1.0;
    } else {
        return 0.0;  // No correction needed
    }
}
```

**What's happening**:
- `t` = current phase (0.0 to 1.0)
- `dt` = frequency/sample_rate (how much phase advances per sample)
- The polynomial smooths the sharp transition over ~2 samples

**Why polynomials?** The ideal solution would convolve with a sinc function, but that's infinitely long. PolyBLEP approximates it with a simple, fast polynomial that only affects samples near discontinuities.

**Visual representation**:
```
NAIVE SAWTOOTH:           WITH PolyBLEP:
     /|                        /┐
    / |                       / │
   /  |                      /  │
  /   |                     /   │
 /    |                    /    │
```

#### FM Synthesis

Your engine includes **Frequency Modulation** synthesis:

```rust
pub fn fm_waveform(carrier_freq: f32, modulator_freq: f32,
                   modulation_index: f32, ...) -> Vec<f32> {
    (0..sample_count).map(|n| {
        let t = n as f32 / sample_rate;
        (2.0 * PI * carrier_freq * t +
         modulation_index * (2.0 * PI * modulator_freq * t).sin()
        ).sin()
    }).collect()
}
```

**The FM equation**: `sin(2πfc*t + β*sin(2πfm*t))`
- `fc` = carrier frequency (the pitch you hear)
- `fm` = modulator frequency
- `β` = modulation index (intensity)

**What it does**: The modulator oscillator "wobbles" the carrier's frequency, creating rich harmonic content. This is how DX7 and FM8 synthesizers work!

**The ratio `fm/fc` determines the character**:
- 1:1 = adds odd harmonics (clarinet-like)
- 2:1 = adds even harmonics (oboe-like)
- Non-integer = inharmonic metallic sounds (bells, FM bass)

---

### ADSR Envelope (`envelope.rs`)

The envelope shapes amplitude over time, making sounds feel musical:

```rust
pub fn apply_adsr(samples: &mut [f32], adsr: &ADSR, sample_rate: f32) {
    for (i, sample) in samples.iter_mut().enumerate() {
        let amplitude = if i < attack_samples {
            // ATTACK: Ramp from 0 to 1
            (i as f32) / (attack_samples as f32)
        } else if i < attack_samples + decay_samples {
            // DECAY: Ramp from 1 to sustain level
            1.0 - ((1.0 - adsr.sustain) * progress)
        } else if i < ... + sustain_samples {
            // SUSTAIN: Hold at sustain level
            adsr.sustain
        } else {
            // RELEASE: Fade from sustain to 0
            adsr.sustain * (1.0 - progress)
        };
        *sample *= amplitude;
    }
}
```

**Visual**:
```
Amplitude
    1 │    ╱╲
      │   ╱  ╲___________
  0.7 │  ╱              ╲
      │ ╱                ╲
    0 │╱                  ╲______
      └─────────────────────────→ Time
        A   D     S        R
      (10ms)(100ms)(hold)(200ms)
```

**Why linear interpolation works**: For short durations (milliseconds), linear ramps sound smooth. Professional synths often use exponential curves for more natural decay, but linear is computationally cheaper.

---

### Filters (`filter.rs`)

#### One-Pole Filter (Simple Low-Pass)

The simplest filter - exponentially smooths the signal:

```rust
pub fn process_sample(&mut self, input: f32, sample_rate: f32) -> f32 {
    let rc = 1.0 / (2.0 * PI * self.cutoff);  // Time constant
    let dt = 1.0 / sample_rate;               // Sample period
    let alpha = dt / (rc + dt);               // Smoothing factor

    self.state = self.state + alpha * (input - self.state);
    self.state
}
```

**The math**: This is a discretized RC circuit!
- `RC` = resistance × capacitance (determines cutoff)
- `alpha` = how much to blend current input vs previous output
- Higher cutoff → higher alpha → more responsive

**Intuition**: It's like a weighted average that "chases" the input. Low cutoff = slow chase (smooths high frequencies).

#### State-Variable Filter (Multi-Mode)

A more sophisticated 2-pole filter that can do low-pass, high-pass, band-pass, and notch:

```rust
pub fn process_sample(&mut self, input: f32, sample_rate: f32) -> f32 {
    let f = 2.0 * (PI * self.cutoff / sample_rate).sin();
    let q = 1.0 / self.resonance;

    // The core equations:
    self.lp = self.lp + f * self.bp;           // Low-pass output
    let hp = input - self.lp - q * self.bp;    // High-pass output
    self.bp = self.bp + f * hp;                // Band-pass output

    match self.mode {
        LowPass => self.lp,
        HighPass => hp,
        BandPass => self.bp,
        Notch => input - q * self.bp,
    }
}
```

**The magic of state variables**: This topology naturally produces all filter types simultaneously! The `lp` (low-pass) and `bp` (band-pass) are stored as "state" between samples.

**Resonance (`Q`)**:
- Q = 1/resonance creates a peak at the cutoff frequency
- Higher resonance → sharper peak → more "squelchy" sound
- Your code limits it to avoid self-oscillation (when Q is so high the filter rings forever)

**Frequency Response**:
```
LOW-PASS                    HIGH-PASS
  │────────╲                     ╱────────
  │         ╲                   ╱
  │          ╲                 ╱
  └───────────╲───            ╱───────────
           cutoff            cutoff

BAND-PASS                   NOTCH
       ╱╲                   ────╲  ╱────
      ╱  ╲                       ╲╱
     ╱    ╲
  ──╱      ╲──
    cutoff                    cutoff
```

---

### LFO (`lfo.rs`)

Low-Frequency Oscillators modulate parameters over time:

```rust
pub fn apply_lfo_amplitude(samples: &mut [f32], lfo: &LFO, sample_rate: f32) {
    let lfo_samples = generate_waveform(lfo.waveform, lfo.rate, ...);

    for (i, sample) in samples.iter_mut().enumerate() {
        // Map LFO [-1, 1] to [1-depth, 1+depth]
        let mod_value = lfo_samples[i] * lfo.depth;
        *sample *= 1.0 + mod_value;
    }
}
```

**Common uses**:
- **Tremolo**: LFO → Amplitude (wavering volume)
- **Vibrato**: LFO → Pitch (wavering pitch)
- **Wah**: LFO → Filter cutoff (sweeping tone)
- **Auto-pan**: LFO → Pan position (stereo movement)

**Pitch modulation math**:
```rust
let semitones = lfo_val * lfo.depth * 2.0;
2.0f32.powf(semitones / 12.0)  // Convert semitones to frequency multiplier
```

Why `2^(semitones/12)`? Western music divides the octave (2:1 frequency ratio) into 12 semitones. So each semitone is the 12th root of 2.

---

### DSP Chain (`dsp.rs`)

A flexible processor chain using Rust's trait system:

```rust
pub trait AudioProcessor {
    fn process(&mut self, input: &mut [f32], sample_rate: f32);
}

pub struct DSPChain {
    processors: Vec<Box<dyn AudioProcessor>>,
}

impl DSPChain {
    pub fn process(&mut self, samples: &mut [f32], sample_rate: f32) {
        for processor in self.processors.iter_mut() {
            processor.process(samples, sample_rate);
        }
    }
}
```

**The pattern**: Each processor mutates the sample buffer in-place, then passes it to the next. This is memory-efficient (no allocations during playback) and cache-friendly.

---

### Stereo Panning

```rust
pub fn pan_stereo(mono_samples: &[f32], pan: f32) -> Vec<(f32, f32)> {
    let pan = pan.max(0.0).min(1.0);
    mono_samples.iter().map(|&s| {
        let left = s * (1.0 - pan).sqrt();
        let right = s * pan.sqrt();
        (left, right)
    }).collect()
}
```

**Why square root?** This is called **constant-power panning**.

With linear panning, center (0.5, 0.5) sounds quieter than hard left/right (1.0, 0.0).
Power is proportional to amplitude squared, so:
- Linear center: `0.5² + 0.5² = 0.5` (50% power)
- Sqrt center: `√0.5² + √0.5² = 1.0` (100% power)

---

## Part 3: Enhancement Ideas

Based on the research and your current codebase, here are prioritized enhancement ideas:

### High-Impact Additions

1. **Wavetable Synthesis**
   - Load custom waveforms instead of just sine/saw/square/triangle
   - Interpolate between wavetables for morphing sounds
   - Reference: [cprimozic wavetable blog](https://cprimozic.net/blog/buliding-a-wavetable-synthesizer-with-rust-wasm-and-webaudio/)

2. **More Filter Types**
   - Add formant filters for vocal sounds
   - Implement Moog-style ladder filter for classic analog tone
   - Consider comb filters for metallic/flanging effects

3. **Reverb in Rust**
   - Implement Freeverb or Schroeder reverb algorithm
   - Would give you more control than Web Audio's ConvolverNode

4. **Polyphonic Unison**
   - Detune multiple oscillators slightly for "thick" sound
   - Common in modern synths (supersaw)

### Medium Effort

5. **Audio Worklet Integration**
   - Move WASM processing to AudioWorkletProcessor
   - Better timing, lower latency
   - Reference: [dev.to AudioWorklet tutorial](https://dev.to/speratus/how-i-used-wasm-pack-to-build-a-webassembly-module-for-an-audioworkletprocessor-4aa7)

6. **Preset System**
   - Save/load parameter combinations
   - Include factory presets demonstrating different sounds

7. **MIDI CC Support**
   - Map MIDI control change messages to parameters
   - Allows hardware controller integration

### Sample Library Expansion

8. **Freesound Integration**
   - Add ability to search and download sounds from Freesound API
   - Automatic attribution handling

9. **Sample Slicing**
   - Divide long samples into regions
   - Map regions across keyboard

---

## Further Reading

### DSP Theory
- [The Scientist and Engineer's Guide to DSP](https://www.dspguide.com/) - Free online book
- [Julius O. Smith's DSP Resources](https://ccrma.stanford.edu/~jos/) - Stanford professor's comprehensive site
- [Martin Finke's PolyBLEP Tutorial](https://www.martin-finke.de/articles/audio-plugins-018-polyblep-oscillator/)

### Rust Audio
- [Rust Audio Discourse](https://rust.audio/) - Community resources
- [RustAudio GitHub](https://github.com/RustAudio) - Open source projects

### Web Audio
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Official documentation
- [Web Audio API Specification](https://www.w3.org/TR/webaudio/) - W3C spec

---

*This document was generated as a learning resource for the Vangelis synthesizer project.*
