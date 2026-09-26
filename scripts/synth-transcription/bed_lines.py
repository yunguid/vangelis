"""The low bed under the record (0:12 to the end): a sound that repeats every 1.692 s, so it lives on the lines of a
0.590965 Hz grid. The LINES loudest of them between 23 and 65 Hz (median level over 20-526 s), and the F#1 drone at
46.56 Hz, which is off the grid, each with its level every NODE_S seconds, for make_midi.py --bed.

A line's level is its amplitude on the mid channel (decimated to 250 Hz) in 16 s Hann windows every 2 s, by
projection onto its frequency; a running median of five windows is read at the nodes. The bed comes in at 12.2 s
with a 1 s rise, as the record's does; the windows before 20 s straddle the silent start, so the nodes up to 20 s hold
the 20 s level. Levels are dB (to 0.01) re the loudest node of all lines; ref_db is that node's level in the record
(dB amplitude, before any --fix).

--fix: per-line offsets (dB, render minus record, keyed by each line's hz as written here), from rendering bed.json
the way the page plays it and reading the render the same way. Each line's offset is taken out of it, and the lines
are put re their loudest node again (CC 11 cannot go over 0 dB).

usage: bed_lines.py record.wav bed.json [--fix offsets.json]
"""
import argparse, json
import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter
from scipy.signal import decimate

GRID = 0.590965     # Hz: the line spacing whose phases hold steadiest over the piece
READ_GRID = 0.59102  # Hz: the first estimate (folding 0:14-0:54). The grid lines' levels are read here, as they were
                     # for the render the --fix offsets come from; reading them on GRID moves a node by 0.1 dB (median,
                     # up to 1.5 dB), which would call for a new round of offsets
DRONE = 46.56       # Hz
LINES = 20; NODE_S = 4.0; SMOOTH = 5

ap = argparse.ArgumentParser(); ap.add_argument('record'); ap.add_argument('out'); ap.add_argument('--fix')
a = ap.parse_args()
x, sr = sf.read(a.record, dtype='float64')
assert sr == 48000, sr
L, R = (decimate(decimate(decimate(x[:, c], 4, ftype='fir'), 3, ftype='fir'), 2, ftype='fir') for c in (0, 1))
fs = 250; y = decimate(decimate((L + R) / 2, 4, ftype='fir'), 2, ftype='fir')
N = 16 * fs; w = np.hanning(N); tt = np.arange(N) / fs
ts = np.arange(8, len(y) / fs - 8, 2.0)  # window centres


def levels(freqs):
    E = np.exp(-2j * np.pi * np.asarray(freqs, float)[:, None] * tt[None, :]) * w[None, :]
    A = np.array([np.abs(E @ y[int((t - 8) * fs):int((t - 8) * fs) + N]) * 2 / w.sum() for t in ts]).T
    return 20 * np.log10(A + 1e-12)


ks = np.arange(40, 111)
Lk = levels(ks * READ_GRID)
med = np.median(Lk[:, (ts >= 20) & (ts <= 526)], axis=1)
lines = sorted([(float(ks[i] * GRID), Lk[i]) for i in np.argsort(-med)[:LINES]] + [(DRONE, levels([DRONE])[0])],
               key=lambda line: line[0])
nodes = np.concatenate([[12.2, 13.2], np.arange(16, 530, NODE_S), [532.0]])
curves = []
for hz, lv in lines:
    v = np.interp(np.clip(nodes, 20, 526), ts, median_filter(lv, size=SMOOTH, mode='nearest'))
    v[0] -= 40  # 12.2 s: silent; full by 13.2 s
    curves.append(v)
ref = max(v.max() for v in curves)
db = [np.array([round(float(v - ref), 2) for v in c]) for c in curves]
if a.fix:
    fix = json.load(open(a.fix))
    db = [d - fix[str(round(hz, 4))] for (hz, _), d in zip(lines, db)]
top = max(d.max() for d in db)
out = dict(grid=GRID, ref_db=round(float(ref), 2), node_s=NODE_S,
           lines=[dict(hz=round(hz, 4), t=[round(float(t), 2) for t in nodes], db=[round(float(v - top), 2) for v in d])
                  for (hz, _), d in zip(lines, db)])
json.dump(out, open(a.out, 'w'))
print(len(lines), 'lines:', ' '.join(f'{hz:.2f}' for hz, _ in lines), f'; ref {ref:.1f} dB',
      f'; offsets taken out, then {-top:+.2f} dB to the loudest node' if a.fix else '')
