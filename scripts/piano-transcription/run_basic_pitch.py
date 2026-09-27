"""Spotify basic-pitch (0.4.0, ONNX) note events over the piano's range, the cross-check on
the ByteDance model. Its own event times already account for its windowing (the raw
posteriors' frames are not evenly spaced; see scripts/synth-transcription/layers.py).
The audio is moved to A440 first and the times mapped back, as run_bytedance.py does.

usage: run_basic_pitch.py audio.wav cents out.json
"""
import sys, json, pathlib, tempfile, numpy as np, soundfile as sf
from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
src, cents, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
x, sr = sf.read(src, dtype='float32', always_2d=True)
speed = 2 ** (-cents / 1200)
tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
sf.write(tmp, x.mean(1), int(round(sr * speed)), subtype='FLOAT')
model = Model(str(pathlib.Path(ICASSP_2022_MODEL_PATH).parent / 'nmp.onnx'))
_, _, events = predict(tmp, model, onset_threshold=0.5, frame_threshold=0.3, minimum_note_length=58,
                       minimum_frequency=27, maximum_frequency=4200, multiple_pitch_bends=False, melodia_trick=True)
notes = sorted(({'on': float(s) * speed, 'off': float(e) * speed, 'pitch': int(p), 'amp': float(a)}
                for s, e, p, a, _ in events), key=lambda n: (n['on'], n['pitch']))
json.dump({'source': src, 'cents': cents, 'notes': notes}, open(out, 'w'))
print(out, len(notes), 'notes')
