#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${FRONTEND_DIR}/public/raylib"
RAYLIB_DIR="${RAYLIB_DIR:-${FRONTEND_DIR}/raylib/vendor/raylib}"
RAYLIB_SRC="${RAYLIB_DIR}/src"
RAYLIB_EXTERNAL="${RAYLIB_SRC}/external"
EM_CACHE_DIR="${EM_CACHE_DIR:-${SCRIPT_DIR}/.emcache}"

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found. Install Emscripten and ensure emcc is on PATH." >&2
  exit 1
fi

if [ ! -d "${RAYLIB_SRC}" ]; then
  echo "raylib source not found at ${RAYLIB_DIR}." >&2
  echo "Set RAYLIB_DIR to your raylib checkout (expects /src)." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
mkdir -p "${EM_CACHE_DIR}"

RAYLIB_SOURCES=(
  "${SCRIPT_DIR}/wavecandy.c"
  "${RAYLIB_SRC}/rcore.c"
  "${RAYLIB_SRC}/rshapes.c"
  "${RAYLIB_SRC}/rtextures.c"
  "${RAYLIB_SRC}/rtext.c"
  "${RAYLIB_SRC}/rmodels.c"
  "${RAYLIB_SRC}/raudio.c"
)

if [ -f "${RAYLIB_SRC}/utils.c" ]; then
  RAYLIB_SOURCES+=("${RAYLIB_SRC}/utils.c")
fi

EM_CACHE="${EM_CACHE_DIR}" emcc \
  "${RAYLIB_SOURCES[@]}" \
  -I"${RAYLIB_SRC}" \
  -I"${RAYLIB_EXTERNAL}/glfw/include" \
  -DPLATFORM_WEB -DGRAPHICS_API_OPENGL_ES2 \
  -sUSE_GLFW=3 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sMODULARIZE=1 \
  -sEXPORT_NAME=createWaveCandyModule \
  -sEXPORTED_FUNCTIONS=_wc_get_wave_ptr,_wc_get_left_ptr,_wc_get_right_ptr,_wc_get_freq_ptr,_wc_get_wave_len,_wc_get_left_len,_wc_get_right_len,_wc_get_freq_len,_wc_set_show_vector,_wc_get_show_vector,_wc_toggle_vector,_wc_set_size,_main \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPF32,HEAPU8 \
  -O3 \
  -o "${OUTPUT_DIR}/wavecandy.js"

echo "Built ${OUTPUT_DIR}/wavecandy.js and ${OUTPUT_DIR}/wavecandy.wasm"
