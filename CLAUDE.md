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
- **Rust/WASM** (`audio-engine/`) - High-performance waveform generation with PolyBLEP anti-aliasing
- **Frontend** (`frontend/`) - React app with Web Audio API integration

### Audio Pipeline
```
AudioWorklet synth (polyBLEP + FM + ADSR + filter + LFO + unison)
    -> Input bus
    -> Compressor
    -> Distortion
    -> Delay (with feedback)
    -> Reverb (convolution)
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
│   ├── AudioControls.jsx      # ADSR, effects, and filter controls
│   ├── ErrorBoundary.jsx      # React error boundary
│   ├── PresetManager.jsx      # Save/load synth presets
│   ├── Scene.jsx              # 3D background (Three.js)
│   ├── UIOverlay.jsx          # Waveform selector overlay
│   ├── WaveCandy*.jsx         # Audio visualizers
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
├── hooks/
│   └── useMidiPlayback.js     # MIDI scheduling and playback engine
│
├── utils/
│   ├── math.js                # Shared math utilities (clamp, MIDI helpers)
│   ├── midiParser.js          # Parse .mid files using @tonejs/midi
│   ├── sampleStorage.js       # IndexedDB storage for sample library
│   ├── audioParams.js         # Audio parameter definitions and sanitization
│   │
│   └── audioEngine/           # Core audio engine modules
│       ├── constants.js       # Audio constants (sample rate, pool sizes)
│       ├── graph.js           # Web Audio graph creation
│       ├── samplePool.js      # Voice pool for sample playback
│       └── recorder.js        # Recording and WAV export
│
├── audio/
│   └── synth-worklet.js       # AudioWorklet processor (synthesis core)
│
└── wasm/                      # Compiled Rust WASM modules
```

## Key Features

### Real-time Synthesis
- AudioWorklet-based polyphonic synth with PolyBLEP anti-aliasing for saw/square
- FM synthesis with adjustable modulation index and ratio
- ADSR envelopes for amplitude and filter
- State-variable filter with resonance
- LFO modulation (pitch, filter, amplitude)
- Unison with configurable voice count and detune

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

### MIDI Playback
- Load .mid files (built-in library or upload)
- Play MIDI through the synth with full sound engine
- Visual feedback on keyboard shows active notes
- Play/pause/stop controls with progress bar

### Recording
- Record button captures all audio output
- Uses ScriptProcessorNode to capture raw PCM
- Exports as WAV format with automatic download

### Effects Chain
- **Compressor** - Dynamics control
- **Distortion** - Soft clipping with adjustable drive
- **Delay** - Tempo-synced with feedback
- **Reverb** - Convolution-based room simulation

## Development

```bash
cd sound-engine/frontend
npm install
npm run dev
```

Build WASM module (optional, for Rust changes):
```bash
cd sound-engine/audio-engine
wasm-pack build --target web
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
