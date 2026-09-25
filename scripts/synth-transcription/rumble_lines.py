"""The low bed under the record (0:12 to the end): the level (dBFS, mean of the channels) of
each of its steady tones between 30 and 52 Hz over six spans, from a 1 kHz-decimated FFT
of each span (0.01-0.02 Hz resolution). The tones were found by eye in a long spectrum.

usage: rumble_lines.py record.wav out.json
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import decimate

LINES = [30.78, 34.3, 37.25, 38.43, 40.79, 41.96, 43.15, 44.32, 45.51, 46.5, 51.41]
SPANS = [(12, 60), (60, 150), (150, 250), (250, 350), (350, 450), (450, 528)]
x, sr = sf.read(sys.argv[1], dtype='float64')


def levels(channel, a, b):
    y = decimate(decimate(channel[int(a * sr):int(b * sr)], 8), 6)
    w = np.hanning(len(y)); Y = np.fft.rfft(y * w) / (w.sum() / 2); f = np.fft.rfftfreq(len(y), 1 / 1000)
    return [20 * np.log10(np.abs(Y[(f > hz - 0.12) & (f < hz + 0.12)]).max() + 1e-12) for hz in LINES]


out = {str(hz): [] for hz in LINES}
for a, b in SPANS:
    both = np.mean([levels(x[:, c], a, b) for c in (0, 1)], axis=0)
    for hz, v in zip(LINES, both): out[str(hz)].append(round(float(v), 1))
json.dump(dict(lines=LINES, spans=SPANS, levels=out), open(sys.argv[2], 'w'))
for hz in LINES: print(f'{hz:6.2f} Hz', out[str(hz)])
