"""Spotify basic-pitch (0.4.0, ONNX) note events and raw posteriors, as a fourth, weaker voter for
consensus.py. Run it from its own environment (see README).

usage: run_basic_pitch.py audio.wav out_prefix onset_threshold frame_threshold
"""
import sys, json, numpy as np
from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
import pathlib
onnx = pathlib.Path(ICASSP_2022_MODEL_PATH).parent / 'nmp.onnx'
model = Model(str(onnx))
out, midi, events = predict(sys.argv[1], model, onset_threshold=float(sys.argv[3]), frame_threshold=float(sys.argv[4]),
                            minimum_note_length=40, minimum_frequency=70, maximum_frequency=1400, multiple_pitch_bends=True, melodia_trick=True)
np.savez_compressed(sys.argv[2] + '.npz', note=out['note'], onset=out['onset'], contour=out['contour'])
notes = [dict(start=float(s), end=float(e), midi=int(p), amp=float(a), bends=[int(b) for b in (bd or [])]) for s, e, p, a, bd in events]
notes.sort(key=lambda n: (n['start'], n['midi']))
json.dump(notes, open(sys.argv[2] + '.json', 'w'))
print(len(notes), 'notes; frames', out['note'].shape)
