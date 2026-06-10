#!/bin/bash
set -e

echo "🚀 Building Vangelis for GitHub Pages..."

# The synth DSP runs in a pure-JS AudioWorklet — no WASM build step needed.

# Build frontend
echo "⚛️  Building React frontend..."
cd sound-engine/frontend
npm install --legacy-peer-deps
npm run build
cd ../..

echo "✅ Build complete! Files ready in sound-engine/frontend/dist/"
echo "📁 Copying files to root for GitHub Pages..."
cp -r sound-engine/frontend/dist/* .
touch .nojekyll
echo "🌐 Deploy to GitHub Pages by pushing to main branch"
