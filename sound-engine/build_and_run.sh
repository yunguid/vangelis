#!/bin/bash
set -e

echo "📦 Building audio engine (Rust to WASM)..."
cd audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg

echo "🎨 Building frontend (React/Vite)..."
cd ../frontend
npm install
npm run build

echo "🚀 Launching backend server (Rocket)..."
cd ../backend
cargo run
