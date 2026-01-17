# Raylib WaveCandy (Option 2A)

This folder contains the raylib-based WaveCandy renderer (WASM) for the frontend.

## Requirements
- Emscripten (`emcc`) installed and on your PATH.
- A raylib source checkout (expects `raylib/src`).

## Build
```bash
cd sound-engine/frontend/raylib
./build_wavecandy.sh
```

If raylib lives elsewhere:
```bash
RAYLIB_DIR=/path/to/raylib ./build_wavecandy.sh
```

The build drops `wavecandy.js` + `wavecandy.wasm` into:
```
sound-engine/frontend/public/raylib/
```

## Runtime
The frontend loads the module from `/raylib/wavecandy.js` and streams analysis data
into the WASM heap. If the module is missing, the app falls back to the canvas
WaveCandy implementation.
