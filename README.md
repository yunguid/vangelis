# Vangelis

WebAssembly synthesizer with Rust audio engine and React interface.

## Quick Start

```bash
./sound-engine/build_and_run.sh
```

## Structure

- `sound-engine/audio-engine/` - Rust WASM audio processing
- `sound-engine/backend/` - Rocket file server  
- `sound-engine/frontend/` - React UI with keyboard

## Manual Build

```bash
# Build WASM
cd sound-engine/audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg

# Build frontend
cd ../frontend
npm install && npm run build

# Run server
cd ../backend
cargo run
```

## Dependencies

- Rust + wasm-pack
- Node.js + npm
- Cargo

Open http://localhost:8000