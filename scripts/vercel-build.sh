#!/usr/bin/env bash
set -euo pipefail

export CARGO_HOME="$HOME/.cargo"
export RUSTUP_HOME="$HOME/.rustup"
export PATH="$CARGO_HOME/bin:$PATH"
export RUSTUP_INIT_SKIP_PATH_CHECK=yes

curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
rustup default stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked

cd sound-engine/audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg

cd ../frontend
npm run build
