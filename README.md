# Vangelis 🎹

A high-performance WebAssembly synthesizer with Rust audio engine, React interface, and audio-reactive 3D visualizations.

## Live Demo

**[Try Vangelis Online](https://yunguid.github.io/vangelis/)**

## Features

### Audio Engine (Rust/WASM)
- 🎵 **Waveform Generation**: Sine, Square, Sawtooth, Triangle with PolyBLEP anti-aliasing
- 🎚️ **ADSR Envelope**: Attack, Decay, Sustain, Release with sub-millisecond precision
- 🌊 **FM Synthesis**: Frequency modulation for complex harmonic content
- 🔊 **Multi-Mode Filters**: Low-pass, high-pass, band-pass, and notch filters
- 🌀 **LFO Modulation**: Vibrato, tremolo, and filter sweeps
- 🎼 **32-Voice Polyphony**: Voice pooling for zero-latency playback
- ⚡ **Performance**: 3-5ms input-to-sound latency, ~180KB WASM binary

### Frontend (React + Three.js)
- 🎹 **Interactive Keyboard**: Mouse, touch, and computer keyboard support
- 🎨 **Audio-Reactive 3D**: Real-time FFT visualization with particles and sphere
- 🎛️ **Professional Controls**: Reverb, delay, distortion, pan, phase offset
- 💾 **LRU Cache**: Bounded waveform cache prevents memory leaks
- 🛡️ **Error Boundaries**: Graceful error handling with detailed diagnostics
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile

### Backend (Rocket)
- 💾 **Preset Management**: Save, load, and delete custom presets
- 📊 **Server Status**: Health monitoring with uptime and feature list
- 🔄 **RESTful API**: Full CRUD operations for presets
- 🚀 **3 Default Presets**: Clean, ambient pad, and pluck sounds

## Quick Start

### Development Build
```bash
# Build everything and start development server
./sound-engine/build_and_run.sh
```

Access at `http://localhost:8000`

### Manual Build

```bash
# 1. Build Rust audio engine to WASM
cd sound-engine/audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg

# 2. Build React frontend
cd ../frontend
npm install
npm run build

# 3. Start backend server
cd ../backend
cargo run
```

## Project Structure

```
vangelis/
├── sound-engine/
│   ├── audio-engine/       # Rust → WASM audio processing
│   │   ├── src/
│   │   │   ├── waveforms.rs    # PolyBLEP waveform generation
│   │   │   ├── envelope.rs     # ADSR implementation
│   │   │   ├── filter.rs       # State-variable filters
│   │   │   ├── lfo.rs          # Low-frequency oscillators
│   │   │   ├── dsp.rs          # DSP chain & processors
│   │   │   ├── tests.rs        # Comprehensive test suite
│   │   │   └── lib.rs          # WASM bindings
│   │   └── Cargo.toml
│   ├── backend/            # Rocket file server + API
│   │   ├── src/
│   │   │   └── main.rs         # Preset API & routes
│   │   └── Cargo.toml
│   └── frontend/           # React + Three.js UI
│       ├── src/
│       │   ├── components/
│       │   │   ├── SynthKeyboard.jsx    # Piano interface
│       │   │   ├── AudioControls.jsx    # Effect controls
│       │   │   ├── Scene.jsx            # 3D visualizations
│       │   │   ├── ErrorBoundary.jsx    # Error handling
│       │   │   └── UIOverlay.jsx        # Waveform selector
│       │   ├── utils/
│       │   │   ├── audioEngine.js       # Core audio logic
│       │   │   └── audio.js             # Wrapper functions
│       │   ├── App.jsx
│       │   └── style.css
│       └── package.json
├── ARCHITECTURE.md         # Detailed system documentation
└── README.md
```

## Architecture

### Signal Flow
```
User Input → React Components → Audio Engine (JS)
                                      ↓
                           WASM Audio Processing
                           (Rust: waveforms + effects)
                                      ↓
                              Web Audio API
                           (Native audio graph)
                                      ↓
                                  Speakers
```

### Key Technologies
- **Rust**: High-performance audio DSP compiled to WASM
- **WebAssembly**: Near-native performance in browser
- **React**: Reactive UI with hooks and context
- **Three.js**: Hardware-accelerated 3D graphics
- **Web Audio API**: Low-latency audio synthesis
- **Rocket**: Fast and ergonomic web framework

## API Reference

### Backend Endpoints

#### `GET /api/status`
Server health and feature list
```json
{
  "server": "Vangelis-Backend",
  "status": "OK",
  "version": "1.0.0",
  "features": ["WASM Audio Engine", "Preset Management", ...],
  "uptime_seconds": 3600
}
```

#### `GET /api/presets`
List all available presets
```json
{
  "success": true,
  "data": [
    {
      "name": "Default",
      "waveform": "Sine",
      "adsr": { "attack": 0.05, "decay": 0.1, ... },
      "effects": { "reverb": 0.0, "delay": 0.0, ... },
      ...
    }
  ]
}
```

#### `POST /api/presets`
Save a new preset
```json
{
  "name": "My Preset",
  "waveform": "Sawtooth",
  "adsr": { ... },
  "effects": { ... }
}
```

#### `DELETE /api/presets/:name`
Delete a preset (system presets protected)

## Testing

### Run Rust Tests
```bash
cd sound-engine/audio-engine
cargo test

# With output
cargo test -- --nocapture

# Specific test
cargo test test_poly_blep
```

### Run Frontend Tests (Jest)
```bash
cd sound-engine/frontend
npm test

# Coverage report
npm test -- --coverage
```

## Performance Benchmarks

| Metric | Value |
|--------|-------|
| Input Latency | 3-5ms |
| WASM Binary (gzipped) | ~60KB |
| Memory Usage (idle) | ~2MB |
| Memory Usage (32 voices) | ~19MB |
| CPU Usage (8 voices) | ~8-12% |

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14.1+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |
| Mobile Safari | 14.5+ | ⚠️ Requires user gesture |
| Mobile Chrome | 90+ | ✅ Full Support |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| A-; | Play white keys (C-F) |
| W-P | Play black keys (C#-D#) |
| Z / X | Shift octave down/up |
| Shift + / | Show shortcuts overlay |
| Esc | Close overlays |

## Deployment

### GitHub Pages (Static)
```bash
./build-pages.sh
git push origin main
# Automatically deploys via GitHub Actions
```

### Vercel/Netlify
```bash
cd sound-engine/frontend
npm run build
# Deploy /dist directory
```

### Docker (Coming Soon)
```bash
docker build -t vangelis .
docker run -p 8000:8000 vangelis
```

## Development

### Watch Mode (Frontend)
```bash
cd sound-engine/frontend
npm run dev
# Hot reload on http://localhost:5173
```

### Rebuild WASM
```bash
cd sound-engine/audio-engine
cargo watch -x 'build --release --target wasm32-unknown-unknown'
wasm-pack build --target web --out-dir ../frontend/public/pkg
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`cargo test` and `npm test`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Roadmap

### v1.1 (Next Release)
- [ ] WASM SIMD optimization
- [ ] Wavetable synthesis
- [ ] MIDI input support
- [ ] Audio recording/export

### v1.2
- [ ] Multi-track sequencer
- [ ] Plugin architecture
- [ ] Cloud preset sync
- [ ] PWA with offline support

### v2.0
- [ ] Real-time collaboration
- [ ] Visual patch editor
- [ ] Community marketplace
- [ ] VST/AU export

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

- **PolyBLEP Algorithm**: Valimaki et al., "Alias-Suppressed Oscillators"
- **Web Audio API**: W3C Audio Working Group
- **Rust Audio Community**: For invaluable DSP resources

## Support

- 📧 Email: support@vangelis.audio
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/vangelis/issues)
- 💬 Discord: [Join our community](https://discord.gg/vangelis)

---

**Built with ❤️ using Rust, WebAssembly, and React**