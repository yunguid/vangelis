# Vangelis - Web MIDI Synthesizer

A browser-based synthesizer with real-time sound generation, custom sample support, MIDI playback, and recording capabilities.

## Project Vision

Vangelis is an expressive, playable web synthesizer that feels responsive and musical. The core goals are:

1. **Real-time synthesis** - Notes respond instantly with proper ADSR envelopes controlled by key press and release
2. **Custom sounds** - Upload audio samples or import entire sample libraries to play via the keyboard
3. **MIDI playback** - Load and play MIDI files through the synth with visual keyboard feedback
4. **Recording** - Capture performances and auto-download as WAV files

## Architecture

### Sound Engine (`/sound-engine`)
- **Frontend** (`frontend/`) - React app with Web Audio API integration
- **DSP core** - Pure-JS AudioWorklet processors in `frontend/src/audio/` (synth, delay,
  reverb, recorder) running on the audio thread. The synth worklet is a thin shell over
  pure-DSP ES modules in `frontend/src/audio/dsp/` (oscillator, envelope, LFO, SVF,
  voice, mod-routes, DC blocker), each unit-tested directly. There is no Rust/WASM in
  the audio path; a worst-case polyphonic benchmark
  (`frontend/scripts/bench_synth_worklet.mjs`) showed ample realtime headroom in plain
  JS, so the DSP stays in hot-reloadable JS.
- **Audio quality gates** - `npm run audit:audio` renders every factory preset (and the
  delay/reverb worklets) against golden masters in `frontend/golden/` — stereo
  per-channel fingerprints, aliasing, DC, heap-drift metrics. See `ENGINE_DESCENT.md`
  and `ENGINE_LEDGER.md` at the repo root for the improvement loop and its history.

### Audio Pipeline
```
AudioWorklet synth (4-pt polyBLEP/BLAMP + FM + ADSR + SVF + LFO
                    + stereo unison spread + DC blocker + soft-clip knee)
    -> Input bus
    -> Compressor
    -> Distortion
    -> Delay (with feedback)
    -> Reverb (algorithmic FDN worklet)
    -> Master Gain
    -> Stereo Panner
    -> Analyser (visualization)
    -> Destination / MediaRecorder

Custom Sample playback:
AudioBufferSource (pitch-shifted sample)
    -> GainNode (per-voice ADSR envelope)
    -> Input bus (shared FX chain)
```

## Frontend Structure

```
frontend/src/
├── App.jsx                    # Main app component, state management
├── style.css                  # Global styles
│
├── components/
│   ├── AudioControls.jsx      # ADSR, effects, filter, and mod-matrix controls
│   ├── ErrorBoundary.jsx      # React error boundary
│   ├── PresetShelf.jsx        # Factory + localStorage preset save/load
│   ├── Scene.jsx              # Audio-reactive WebGL2 shader background
│   ├── UIOverlay.jsx          # Waveform selector overlay
│   ├── WaveCandy*.jsx         # Perceptual visualizer suite (Canvas 2D)
│   ├── controls/
│   │   └── ValueSlider.jsx    # Accessible slider primitive (ARIA, drag, keys, wheel)
│   │
│   ├── Sidebar/               # Collapsible sidebar panel
│   │   ├── index.jsx          # Sidebar container with icon rail
│   │   ├── Sidebar.css        # Sidebar styles
│   │   ├── MidiTab.jsx        # MIDI file browser
│   │   ├── MidiPlayer.jsx     # MIDI playback controls
│   │   └── SamplesTab.jsx     # Sample library browser
│   │
│   └── SynthKeyboard/         # Virtual piano keyboard
│       ├── index.jsx          # Keyboard container
│       ├── components/Key.jsx # Individual key component
│       └── hooks/             # Keyboard-specific hooks
│
├── context/
│   └── SynthContexts.jsx      # SoundControls / MidiTransport / VoicePhrase contexts
│
├── hooks/
│   ├── useMidiPlayback.js     # MIDI scheduling and playback engine
│   └── useWebMidiInput.js     # Hardware MIDI in (notes, pitch bend, mod wheel)
│
├── utils/
│   ├── math.js                # Shared math utilities (clamp, MIDI helpers)
│   ├── midiParser.js          # Parse .mid files using @tonejs/midi
│   ├── sampleStorage.js       # IndexedDB storage for sample library
│   ├── presetStorage.js       # Factory preset bank (categorized) + user presets
│   ├── audioParams.js         # Audio parameter definitions and sanitization
│   │
│   └── audioEngine/           # Core audio engine modules
│       ├── constants.js       # Audio constants (sample rate, pool sizes)
│       ├── graph.js           # Web Audio graph creation
│       ├── samplePool.js      # Voice pool for sample playback
│       └── recorder.js        # Recording and WAV export
│
└── audio/
    ├── synth-worklet.js       # AudioWorklet shell (message protocol, voice pool, master clip)
    ├── dsp/                   # Pure-DSP modules (oscillator, envelope, lfo, svf,
    │                          #   voice, mod-routes, dc-blocker) + direct unit tests
    ├── delay-worklet.js       # Tempo-synced feedback delay (contractive feedback loop)
    ├── reverb-worklet.js      # Algorithmic FDN reverb
    └── recorder-worklet.js    # PCM capture for WAV export
```

## Key Features

### Real-time Synthesis
- AudioWorklet-based polyphonic synth with PolyBLEP (saw/square) and PolyBLAMP (triangle) anti-aliasing
- FM synthesis with adjustable modulation index and ratio
- ADSR envelopes for amplitude, plus a dedicated modulation envelope
- State-variable filter with resonance
- Modulation matrix: 7 sources (2 multi-shape LFOs incl. S&H, amp env, mod env,
  velocity, key track, mod wheel) → 5 destinations (pitch, cutoff, amp, FM index,
  detune), up to 8 routes with bipolar depth
- Glide/portamento, pitch bend and mod wheel messages, velocity curves
- Web MIDI hardware input (notes, bend wheel, CC1)
- Unison with configurable voice count and detune, spread equal-power across the stereo field

### Custom Sample Mode
- Upload WAV/MP3/OGG files as custom instruments
- Samples mapped across keyboard with pitch shifting
- Supports one-shot and looped playback
- Per-voice envelopes applied to samples

### Sample Library (IndexedDB)
- Import entire folders of samples organized by category
- Samples persist in browser storage across sessions
- Browse by category, search, and quick-select
- Storage stats show library size

### Factory Preset Bank
- 45 hand-designed patches in `utils/presetStorage.js`, grouped by category
  (Leads / Pads & Strings / Bass / Keys & Bells / Motion & Texture), built on
  the CS-80 / Blade Runner palette, classic rare synths (Prophet-5, Jupiter-8,
  Oberheim, PPG, Fairlight, Juno-106, ARP 2600, Memorymoog) and modern
  hyperpop / trap / rage production sounds
- Every factory patch spreads over a fully-specified clean slate so preset
  switching is deterministic (nothing leaks from the previous sound)
- PresetShelf UI: category groups, prev/next cycling, active-patch readout,
  descriptions; user presets persist in localStorage
- `presetStorage.test.js` pins all patches to legal engine ranges

### MIDI Playback
- Load .mid files (built-in library or upload)
- "Originals" corpus: 58 in-house cues composed from scratch for the synth
  presets (beautiful synth, hyperpop, trap, rage, acid, synthwave, ambient…),
  generated by `scripts/generate_original_midis.mjs` into
  `public/midi/originals/` (re-run the script after editing compositions)
- Play MIDI through the synth with full sound engine
- Visual feedback on keyboard shows active notes
- Play/pause/stop controls with progress bar

### Recording
- Record button captures all audio output
- Uses an AudioWorklet (`recorder-worklet.js`) to capture raw PCM on the audio thread
- Exports as WAV format with automatic download

### Effects Chain
- **Compressor** - Dynamics control
- **Distortion** - Soft clipping with adjustable drive
- **Delay** - Tempo-synced with feedback
- **Reverb** - Algorithmic FDN worklet (room/plate/hall/ambient variants)

## Development

```bash
cd sound-engine/frontend
npm install
npm run dev
```

Benchmark the synth worklet's DSP hot loop:
```bash
cd sound-engine/frontend
node scripts/bench_synth_worklet.mjs
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| A-; | White keys (C to F) |
| W-P | Black keys (sharps) |
| Z/X | Octave down/up |
| C/V | Velocity down/up |
| Space | Toggle recording |
| ? | Show shortcuts overlay |
| Esc | Close overlays |

## Dependencies

### Core
- React 18
- Vite (build tool)
- Three.js (3D background)

### Audio
- @tonejs/midi (MIDI parsing)
- Web Audio API (AudioWorklet, ConvolverNode, etc.)

### Storage
- IndexedDB (sample library persistence)
