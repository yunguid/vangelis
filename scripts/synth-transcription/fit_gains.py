"""Part levels that make the stems add up to the record: per 2 s window and third-octave
band (80 Hz - 10 kHz), record power ~ sum_k g_k * stem_k power; g >= 0 by least squares on
log-weighted rows (each window and band counts once, loud or quiet).

usage: fit_gains.py record.wav stem1.wav [stem2.wav ...] [--from 0 --to N]"""
import sys, numpy as np, soundfile as sf
from scipy.optimize import nnls
args = [x for x in sys.argv[1:] if not x.startswith('--')]
rec, stems = args[0], args[1:]
t_from = float(sys.argv[sys.argv.index('--from') + 1]) if '--from' in sys.argv else 14.0
t_to = float(sys.argv[sys.argv.index('--to') + 1]) if '--to' in sys.argv else 528.0
centres = 1000 * 2 ** (np.arange(-11, 11) / 3)
def band_powers(path):
    x, sr = sf.read(path, dtype='float64'); x = x.mean(axis=1) if x.ndim > 1 else x
    N = 8192; hop = sr * 2
    f = np.fft.rfftfreq(N, 1 / sr); w = np.hanning(N)
    masks = [(f >= c * 2 ** (-1 / 6)) & (f < c * 2 ** (1 / 6)) for c in centres]
    rows = []
    for s in range(int(t_from * sr), int(t_to * sr) - hop, hop):
        seg = x[s:s + hop]
        P = np.mean([np.abs(np.fft.rfft(seg[i:i + N] * w)) ** 2 for i in range(0, hop - N, N // 2)], axis=0)
        rows.append([P[m].sum() for m in masks])
    return np.array(rows)
R = band_powers(rec); S = [band_powers(s) for s in stems]
n = min(len(R), *[len(s) for s in S]); R = R[:n]; S = [s[:n] for s in S]
# robust: gains (in dB) that minimise the median absolute dB error over all windows and
# bands where the record is within 40 dB of its loudest; coordinate search on a 0.5 dB grid
live = R > R.max() * 1e-4
def cost(gdb):
    fit = sum(10 ** (gi / 10) * s for gi, s in zip(gdb, S))
    e = 10 * np.log10((fit + 1e-12) / (R + 1e-12))[live]
    return np.median(np.abs(e))
gdb = np.zeros(len(S))
for sweep in range(4):
    for k in range(len(S)):
        grid = gdb[k] + np.arange(-30, 30.5, 0.5)
        costs = []
        for v in grid:
            trial = gdb.copy(); trial[k] = v; costs.append(cost(trial))
        gdb[k] = grid[int(np.argmin(costs))]
g = 10 ** (gdb / 10)
print('median |dB error|', round(cost(gdb), 2))
for path, gi in zip(stems, g): print(f'{path.split("/")[-1]}: gain x{gi:.3f} ({10 * np.log10(gi + 1e-12):+.1f} dB power, {20 * np.log10(np.sqrt(gi) + 1e-12):+.1f} dB amplitude)')
fit = sum(gi * s for gi, s in zip(g, S))
err = 10 * np.log10((fit + 1e-12) / (R + 1e-12))
print('fit error per band (median dB, IQR):')
for c, col in zip(centres, err.T): print(f'  {c:7.0f} Hz  {np.median(col):+5.1f}  [{np.percentile(col, 25):+5.1f} {np.percentile(col, 75):+5.1f}]')
