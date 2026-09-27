"""The glides: low buzzy tones whose whole row of harmonics bends up and down together. The
spectrogram's moving part (each bin minus its median over 3 s, which removes the piano's
steady partials) is summed along harmonic combs (harmonics 3-40 between 150 Hz and 2.5 kHz)
for every candidate fundamental from 35 to 140 Hz (1/48 octave), every 50 ms; the best path
through that (no faster than 3 octaves a second, by dynamic programming) is the glide's
pitch, and the comb's strength against the frame's moving energy says whether it sounds.

On Memories of Green this failed (the path pins to the top of the range): the glides' lines
are not one harmonic tone's (their spacing wanders from 23 to 34 Hz, smallest where the arcs
are highest). Kept as the record of what was tried; see the journey.

usage: glide_track.py record.wav out.json [--plot out.png]
"""
import json, sys
import numpy as np, soundfile as sf, scipy.ndimage as nd

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

x, sr = sf.read(sys.argv[1]); x = x.mean(1)
N, hop = 8192, int(0.05 * sr)
fr = np.lib.stride_tricks.sliding_window_view(x, N)[::hop] * np.hanning(N)
S = np.abs(np.fft.rfft(fr, axis=1)); f = np.fft.rfftfreq(N, 1 / sr)
band = (f > 100) & (f < 2600)
L = 20 * np.log10(S[:, band] + 1e-9); fb = f[band]
moving = np.maximum(L - nd.median_filter(L, size=(61, 1)), 0)      # 61 frames = 3 s
cands = 35 * 2 ** (np.arange(0, 2 * 48 + 1) / 48)                   # 35..140 Hz
score = np.zeros((len(moving), len(cands)))
for j, f0 in enumerate(cands):
    idx = [np.argmin(np.abs(fb - k * f0)) for k in range(3, 41) if 150 < k * f0 < 2500]
    score[:, j] = moving[:, idx].mean(1)
# dynamic programming: at most 3 octaves per second -> 48*3*0.05 = 7 bins per frame
step = 7; T = len(score); back = np.zeros((T, len(cands)), int); acc = score[0].copy()
for t in range(1, T):
    best = np.full(len(cands), -1e9); arg = np.zeros(len(cands), int)
    for d in range(-step, step + 1):
        sh = np.roll(acc, d)
        if d > 0: sh[:d] = -1e9
        if d < 0: sh[d:] = -1e9
        better = sh > best; best[better] = sh[better]; arg[better] = (np.arange(len(cands)) - d)[better]
    acc = best + score[t]; back[t] = arg
path = np.zeros(T, int); path[-1] = int(np.argmax(acc))
for t in range(T - 1, 0, -1): path[t - 1] = back[t, path[t]]
f0 = cands[path]; strength = score[np.arange(T), path]; base = np.median(score, 1)
salience = strength - base
times = (np.arange(T) * hop + N / 2) / sr
json.dump({'hop': hop / sr, 'times': times.tolist(), 'f0': f0.tolist(), 'salience': salience.tolist()}, open(sys.argv[2], 'w'))
print('frames', T, 'salience pct', np.percentile(salience, [10, 50, 90]).round(2))
for t0 in range(0, int(times[-1]), 10):
    m = (times >= t0) & (times < t0 + 10)
    print(f'{t0 // 60}:{t0 % 60:02d} f0 {np.min(f0[m]):5.1f}-{np.max(f0[m]):5.1f} Hz  salience {np.median(salience[m]):4.2f}')
if option('--plot'):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(24, 9), sharex=True)
    ax[0].imshow(score.T, origin='lower', aspect='auto', extent=[times[0], times[-1], 0, len(cands)], cmap='magma')
    ax[0].plot(times, path, 'c', lw=0.6); ax[1].plot(times, salience); ax[1].grid(alpha=0.3)
    fig.savefig(option('--plot'), dpi=45, bbox_inches='tight')
