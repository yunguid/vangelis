#!/usr/bin/env bash
set -euo pipefail

curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
export PATH="$HOME/.cargo/bin:$PATH"
cargo install wasm-pack --locked

cd sound-engine/audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg

cd ../frontend
npm run build
