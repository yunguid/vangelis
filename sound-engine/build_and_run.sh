#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building audio engine (Rust to WASM)..."
(
  cd "$SCRIPT_DIR/audio-engine"
  wasm-pack build --target web --out-dir ../frontend/public/pkg
)

echo "Building frontend (React/Vite)..."
(
  cd "$SCRIPT_DIR/frontend"
  rm -rf node_modules
  npm ci
  if [[ -z "${SKIP_MIDI_SYNC:-}" ]]; then
    echo "Syncing Russian MIDI library..."
    node scripts/sync_russian_midis.mjs
  else
    echo "Skipping MIDI sync (SKIP_MIDI_SYNC is set)."
  fi
  npm run build
)

echo "Launching backend server (Rocket)..."
(
  cd "$SCRIPT_DIR/backend"
  cargo run
)
