"""Spotify basic-pitch (0.4.0, ONNX) over the whole record: its note and onset posteriors
(88 keys at 86 frames a second) are what layers.py reads; its own note list is not used
(on this record it splits every held note into dozens). Run it from its own environment.

usage: run_basic_pitch.py audio.wav out_prefix  ->  out_prefix.npz (note, onset, contour)
"""
import sys, pathlib
import numpy as np
from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH

model = Model(str(pathlib.Path(ICASSP_2022_MODEL_PATH).parent / 'nmp.onnx'))
out, _, _ = predict(sys.argv[1], model, onset_threshold=0.4, frame_threshold=0.25,
                    minimum_note_length=40, minimum_frequency=30, maximum_frequency=2000,
                    multiple_pitch_bends=True, melodia_trick=True)
np.savez_compressed(sys.argv[2] + '.npz', note=out['note'], onset=out['onset'], contour=out['contour'])
print('frames', out['note'].shape)
