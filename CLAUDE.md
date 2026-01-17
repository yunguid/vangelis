# Vangelis - Web MIDI Synthesizer

A browser-based synthesizer with real-time sound generation, custom sample support, and recording capabilities.

## Project Vision

Vangelis is an expressive, playable web synthesizer that feels responsive and musical. The core goals are:

1. **Real-time synthesis** - Notes respond instantly with proper attack/decay/sustain/release controlled by key press and release
2. **Custom sounds** - Users can upload their own audio samples to play via the keyboard
3. **Recording** - Capture performances and auto-download as audio files

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
    -> Delay
    -> Reverb
    -> Master Gain
    -> Panner
    -> Destination/MediaRecorder

AudioBufferSource (custom sample playback)
    -> GainNode (per-voice envelope)
    -> Input bus (shared FX chain)
```

## Key Features

### Real-time Synthesis
- AudioWorklet-based polyphonic synth with PolyBLEP anti-aliasing for saw/square
- FM synthesis, ADSR envelopes, state-variable filter, LFO modulation, and unison detune
- Notes sustain for as long as keys are held with accurate release handling

### Custom Sample Mode
- Upload WAV/MP3/OGG files as custom instruments
- Samples mapped across keyboard with pitch shifting
- Supports one-shot and looped playback

### Recording
- Record button captures all audio output
- Automatic download when recording stops
- Exports as WAV format

## Development

```bash
cd sound-engine/frontend
npm install
npm run dev
```

Build WASM module:
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
| Space | Toggle recording |
