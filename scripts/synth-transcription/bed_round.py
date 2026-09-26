"""One closed-loop round for the low bed: each line's level in a render of bed.json (the bed alone, as the page plays
it; a line's two unison voices, CENTS apart, summed in power) against the record's at the line's frequency, both read
as bed_lines.py reads them (the mid channel at 250 Hz, 16 s Hann windows every 2 s, projection onto the frequency).
The median difference over 24-520 s is written per line, keyed by its hz, for bed_lines.py --fix.

usage: bed_round.py record.wav render.wav bed.json out.json [--cents 4]
  render.wav: BRB_PARTS=rumble BRB_NOISE=off; --cents: the bed layer's unisonDetune
"""
import argparse, json
import numpy as np
import soundfile as sf
from scipy.signal import decimate

ap = argparse.ArgumentParser()
for name in ('record', 'render', 'bed', 'out'): ap.add_argument(name)
ap.add_argument('--cents', type=float, default=4)
a = ap.parse_args()
FS = 250; N = 16 * FS; w = np.hanning(N)


def mid(path):
    x, sr = sf.read(path, dtype='float64')
    assert sr == 48000, sr
    L, R = (decimate(decimate(decimate(x[:, c], 4, ftype='fir'), 3, ftype='fir'), 2, ftype='fir') for c in (0, 1))
    return decimate(decimate((L + R) / 2, 4, ftype='fir'), 2, ftype='fir')


def levels(y, freqs):
    ts = np.arange(8, len(y) / FS - 8, 2.0); tt = np.arange(N) / FS
    E = np.exp(-2j * np.pi * freqs[:, None] * tt[None, :]) * w[None, :]
    return ts, 20 * np.log10(np.array([np.abs(E @ y[int((t - 8) * FS):int((t - 8) * FS) + N]) * 2 / w.sum() for t in ts]).T + 1e-12)


hz = np.array([line['hz'] for line in json.load(open(a.bed))['lines']]); split = 2 ** (a.cents / 2400)
ts, rec = levels(mid(a.record), hz)
_, ren = levels(mid(a.render), np.concatenate([hz / split, hz * split]))
ren = 10 * np.log10(10 ** (ren[:len(hz)] / 10) + 10 ** (ren[len(hz):] / 10))
m = min(rec.shape[1], ren.shape[1]); s = (ts[:m] >= 24) & (ts[:m] <= 520)
d = np.median(ren[:, :m][:, s] - rec[:, :m][:, s], axis=1)
json.dump({str(round(float(f), 4)): round(float(v), 2) for f, v in zip(hz, d)}, open(a.out, 'w'))
for f, v in zip(hz, d): print(f'{f:7.2f} Hz: render - record {v:+5.2f} dB')
