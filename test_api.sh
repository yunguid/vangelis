#!/bin/bash
echo "=== Testing Vangelis Backend API ==="
echo ""
echo "1. Server Status:"
curl -s http://localhost:8000/api/status | python3 -m json.tool
echo ""
echo ""
echo "2. List All Presets:"
curl -s http://localhost:8000/api/presets | python3 -m json.tool
echo ""
echo ""
echo "3. Get Default Preset:"
curl -s http://localhost:8000/api/presets/default | python3 -m json.tool
echo ""
echo ""
echo "4. Save Custom Preset:"
curl -s -X POST http://localhost:8000/api/presets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Sound",
    "waveform": "Sawtooth",
    "adsr": {
      "attack": 0.2,
      "decay": 0.3,
      "sustain": 0.5,
      "release": 0.8
    },
    "effects": {
      "reverb": 0.5,
      "delay": 150.0,
      "distortion": 0.2,
      "volume": 0.6
    },
    "author": "Test User",
    "description": "A custom test preset"
  }' | python3 -m json.tool
echo ""
echo ""
echo "5. List Presets Again (should see new preset):"
curl -s http://localhost:8000/api/presets | python3 -m json.tool
