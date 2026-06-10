#!/usr/bin/env bash
set -euo pipefail

# The synth DSP runs in a pure-JS AudioWorklet (sound-engine/frontend/src/audio/).
# No Rust/WASM build step is needed — see PROGRESS.md for the decision record.

cd sound-engine/frontend
npm run build
