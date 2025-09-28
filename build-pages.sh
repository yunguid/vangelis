#!/bin/bash
set -e

echo "🚀 Building Vangelis for GitHub Pages..."

# Build WASM
echo "📦 Building WASM module..."
cd sound-engine/audio-engine
wasm-pack build --target web --out-dir ../frontend/public/pkg
cd ../..

# Build frontend
echo "⚛️  Building React frontend..."
cd sound-engine/frontend
npm install
npm run build
cd ../..

echo "✅ Build complete! Files ready in sound-engine/frontend/dist/"
echo "🌐 Deploy to GitHub Pages by pushing to main branch"
