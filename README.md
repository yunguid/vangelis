# Rust-WASM Audio Synth Engine

A synthesizer built with Rust, WebAssembly (WASM), React, and Rocket.

---

## Project Structure

```
sound-engine/
├── audio-engine/      # Rust audio processing (compiled to WASM)
├── backend/           # Rocket backend server
├── frontend/          # React/Vite frontend
└── tests/             # Testing suite
```

---

## Quickstart

### 1. Build the Audio Engine (Rust to WASM)

```bash
cd audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg
```

### 2. Build the Frontend (React with Vite)

```bash
cd ../frontend
npm install
npm run build
```

### 3. Launch the Backend (Rocket Server)

```bash
cd ../backend
cargo run
```
---

## ⚙️ All-in-one Build Script

```bash
./build_and_run.sh
```

---

### WASM Compilation issues

- Make sure [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) is installed:

```bash
cargo install wasm-pack
```

---

## Deps

- **Frontend**: React, Vite
- **Audio Engine**: Rust, wasm-bindgen
- **Backend**: Rocket v0.5.0

---

