"""Estimate the recording's tuning offset (cents vs A440) and its drift over time
from sharp spectral peaks (parabolic interpolation on a long-window STFT).

usage: tuning.py record.wav
"""
import numpy as np, soundfile as sf, sys
x, sr = sf.read(sys.argv[1], dtype='float64')
if x.ndim > 1: x = x.mean(axis=1)
n = 16384; hop = 2048
win = np.hanning(n)
frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop]
S = np.abs(np.fft.rfft(frames * win, axis=1))
freqs_bin = sr / n
devs, weights, times = [], [], []
for i, row in enumerate(S):
    lo, hi = int(70 / freqs_bin), int(1400 / freqs_bin)
    seg = row[lo:hi]
    thr = seg.max() * 0.08
    peaks = np.where((seg[1:-1] > seg[:-2]) & (seg[1:-1] > seg[2:]) & (seg[1:-1] > thr))[0] + 1
    for p in peaks:
        a, b, c = np.log(seg[p-1:p+2] + 1e-12)
        off = 0.5 * (a - c) / (a - 2*b + c)
        f = (lo + p + off) * freqs_bin
        midi = 69 + 12*np.log2(f/440)
        d = (midi - np.round(midi)) * 100
        devs.append(d); weights.append(seg[p]); times.append(i*hop/sr)
devs, weights, times = map(np.array, (devs, weights, times))
def circ_mean(d, w):
    ang = d/100*2*np.pi
    return np.angle(np.sum(w*np.exp(1j*ang)))/(2*np.pi)*100, np.abs(np.sum(w*np.exp(1j*ang)))/np.sum(w)
m, r = circ_mean(devs, weights)
print('global tuning offset %.1f cents (resultant length %.2f, %d peaks)' % (m, r, len(devs)))
hist, edges = np.histogram(devs, bins=20, range=(-50,50), weights=weights)
for h, e in zip(hist/hist.max(), edges): print('  %+5.0f %s' % (e, '#'*int(h*50)))
for t0 in range(0, int(times.max())+1, 10):
    sel = (times >= t0) & (times < t0+10)
    if sel.sum() > 20:
        mm, rr = circ_mean(devs[sel], weights[sel])
        print('  %3d-%3d s: %+.1f cents (R %.2f, n %d)' % (t0, t0+10, mm, rr, sel.sum()))
