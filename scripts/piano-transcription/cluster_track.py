"""The glides are a chromatic cluster: pure tones a semitone apart (successive lines stand in
a ratio of 1.056-1.065 from 588 to 992 Hz) whose pitch bends up and down together. So the
record's spectrogram (8192-point STFT every 50 ms, 250 Hz-2.5 kHz), with each bin's median
over 3 s taken away (which removes the piano's steady partials), is read against a comb of
lines a semitone apart for every offset from 0 to 99 cents; the best path through the offsets
(circular, at most --step cents per frame, 12 by default) unwrapped is the cluster's pitch in cents from A440's
grid. Also measured along the path: how far the comb stands over the frame's other offsets
(salience, dB), and each semitone line's level from C2 to D#7 on the whole spectrum from
50 Hz, over the intro's first 18 s (where the piano plays only its top register) in the frames
where the cluster is clear. (Its value half a semitone off the line cannot be the reference:
below about 200 Hz the lines are closer than the STFT resolves.)

usage: cluster_track.py record.wav out.json [--step 12] [--plot out.png]
"""
import json, sys
import numpy as np, soundfile as sf, scipy.ndimage as nd

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

x, sr = sf.read(sys.argv[1]); x = x.mean(1)
N, hop = 8192, int(0.05 * sr)
fr = np.lib.stride_tricks.sliding_window_view(x, N)[::hop] * np.hanning(N)
S = np.abs(np.fft.rfft(fr, axis=1)); f = np.fft.rfftfreq(N, 1 / sr)
band = (f > 200) & (f < 2800)
L = 20 * np.log10(S[:, band] + 1e-9); fb = f[band]
wide = (f > 50) & (f < 2800); Lw = 20 * np.log10(S[:, wide] + 1e-9); fw = f[wide]
moving = L - nd.median_filter(L, size=(61, 1))
mids = np.arange(60, 100)                                   # C4 .. D#7 lines on A440's grid
offsets = np.arange(100)
lines = 440 * 2 ** (((mids[None, :] - 69) + offsets[:, None] / 100) / 12)   # (100, lines)
inb = (lines > 250) & (lines < 2500)
score = np.zeros((len(moving), 100))
for o in offsets:
    fl = lines[o][inb[o]]
    vals = np.stack([np.interp(fl, fb, row) for row in moving])  # frames x lines
    score[:, o] = vals.mean(1)
# circular Viterbi, at most 12 cents a frame
T = len(score); step = int(option("--step", 12))
acc = score[0].copy(); back = np.zeros((T, 100), int)
for t in range(1, T):
    best = np.full(100, -1e9); arg = np.zeros(100, int)
    for d in range(-step, step + 1):
        sh = np.roll(acc, d) - 0.02 * abs(d)
        better = sh > best; best[better] = sh[better]; arg[better] = ((offsets - d) % 100)[better]
    acc = best + score[t]; back[t] = arg
path = np.zeros(T, int); path[-1] = int(np.argmax(acc))
for t in range(T - 1, 0, -1): path[t - 1] = back[t, path[t]]
unwrapped = np.unwrap(path / 100 * 2 * np.pi) / (2 * np.pi) * 100
salience = score[np.arange(T), path] - np.median(score, 1)
times = (np.arange(T) * hop + N / 2) / sr
clear = (salience > np.percentile(salience, 60)) & (times < 18)
level_mids = np.arange(36, 100)
levels = []
for m in level_mids:
    fm = 440 * 2 ** (((m - 69) + path / 100) / 12)
    idx = np.flatnonzero(clear)
    v = np.array([np.interp(fm[t], fw, Lw[t]) for t in idx])
    levels.append(float(np.median(v)))
mids = level_mids
json.dump({'hop': hop / sr, 'times': times.round(3).tolist(), 'cents': unwrapped.round(2).tolist(),
           'salience': salience.round(2).tolist(), 'mids': mids.tolist(), 'line_db': levels}, open(sys.argv[2], 'w'))
print(f'frames {T}; unwrapped cents from {unwrapped.min():.0f} to {unwrapped.max():.0f}; salience pct 10/50/90 {np.percentile(salience, [10, 50, 90]).round(2)}')
for t0 in range(0, int(times[-1]), 15):
    mk = (times >= t0) & (times < t0 + 15)
    print(f'{t0 // 60}:{t0 % 60:02d} cents {unwrapped[mk].min():7.1f}..{unwrapped[mk].max():7.1f}  salience {np.median(salience[mk]):5.2f}')
print('line levels (dB):', ' '.join(f'{m}:{v:.0f}' for m, v in zip(mids, levels)))
if option('--plot'):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(3, 1, figsize=(24, 12), sharex=True)
    ax[0].imshow(score.T, origin='lower', aspect='auto', extent=[times[0], times[-1], 0, 100], cmap='magma')
    ax[0].plot(times, path, 'c', lw=0.5); ax[1].plot(times, unwrapped); ax[1].grid(alpha=0.3)
    ax[2].plot(times, salience); ax[2].grid(alpha=0.3)
    fig.savefig(option('--plot'), dpi=45, bbox_inches='tight')
