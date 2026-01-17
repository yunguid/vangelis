#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${FRONTEND_DIR}/public/raylib"
RAYLIB_DIR="${RAYLIB_DIR:-${FRONTEND_DIR}/raylib/vendor/raylib}"

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found. Install Emscripten and ensure emcc is on PATH." >&2
  exit 1
fi

if [ ! -d "${RAYLIB_DIR}/src" ]; then
  echo "raylib source not found at ${RAYLIB_DIR}." >&2
  echo "Set RAYLIB_DIR to your raylib checkout (expects /src)." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

emcc \
  "${SCRIPT_DIR}/wavecandy.c" \
  "${RAYLIB_DIR}/src/raylib.c" \
  -I"${RAYLIB_DIR}/src" \
  -DPLATFORM_WEB -DGRAPHICS_API_OPENGL_ES2 \
  -sUSE_GLFW=3 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createWaveCandyModule \
  -sEXPORTED_FUNCTIONS=_wc_get_wave_ptr,_wc_get_left_ptr,_wc_get_right_ptr,_wc_get_freq_ptr,_wc_get_wave_len,_wc_get_left_len,_wc_get_right_len,_wc_get_freq_len,_wc_set_size,_main \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -O3 \
  -o "${OUTPUT_DIR}/wavecandy.js"

echo "Built ${OUTPUT_DIR}/wavecandy.js and ${OUTPUT_DIR}/wavecandy.wasm"
