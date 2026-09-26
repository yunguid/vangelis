"""Split basic-pitch's note posterior into a slow layer (drone and pad: tones that hold for
seconds) and a fast layer (the played notes on top), then cut each into notes.

slow: posterior smoothed over 1.5 s; a key is on above 0.30, holds above 0.18, lasts >= 2 s,
      gaps under 1 s merge.
fast: what stands clearly above the slow layer: note posterior minus its 1.5 s smoothed self
      is ignored; instead a note is a run above 0.5 that starts with an onset (>0.3 within
      0.1 s) or rises from below 0.2, holds above 0.25, lasts >= 0.2 s.

usage: layers.py bp.npz out.json [--png prefix --page 30]
"""
import argparse, json
import numpy as np
from scipy.ndimage import uniform_filter1d

ap = argparse.ArgumentParser(); ap.add_argument('npz'); ap.add_argument('out')
ap.add_argument('--png'); ap.add_argument('--page', type=float, default=30)
a = ap.parse_args()
z = np.load(a.npz); N = z['note'].astype(np.float32); O = z['onset'].astype(np.float32)
fps = 22050 / 256
F, K = N.shape

# basic-pitch's frames are not 256 samples apart across the whole file: it runs its model on
# windows of 43844 samples hopped by 36164 and keeps 142 frames of each (256 samples apart), so
# each window's frames start 36164 samples after the last window's (0.52% later than i / fps;
# 2.5 s by 8:20, basic_pitch 0.4.0 inference.py). A frame's time on the record:
def ftime(i):
    return ((i // 142) * 36164 + (i % 142) * 256) / 22050

def runs(x, on, hold, min_len, gap):
    out = []; i = 0
    while i < F:
        if x[i] > on:
            s = i
            while s > 0 and x[s - 1] > hold: s -= 1
            e = i
            while e < F and x[e] > hold: e += 1
            out.append([s, e]); i = e
        else:
            i += 1
    merged = []
    for r in out:
        if merged and (r[0] - merged[-1][1]) / fps < gap: merged[-1][1] = max(merged[-1][1], r[1])
        else: merged.append(r)
    return [r for r in merged if (r[1] - r[0]) / fps >= min_len]

slow = uniform_filter1d(N, size=int(1.5 * fps), axis=0)
notes = []
for k in range(K):
    for s, e in runs(slow[:, k], 0.30, 0.18, 2.0, 1.0):
        notes.append(dict(layer='slow', start=round(ftime(s), 2), end=round(ftime(e), 2), midi=21 + k,
                          level=round(float(slow[s:e, k].mean()), 3)))
    x = N[:, k]; o = O[:, k]
    for s, e in runs(x, 0.5, 0.25, 0.2, 0.08):
        # it must start: an onset near its start, or a rise from quiet
        ons = o[max(0, s - 4):s + 9].max()
        pre = x[max(0, s - 9):s].min() if s > 0 else 0
        if ons < 0.3 and pre > 0.2:
            continue
        notes.append(dict(layer='fast', start=round(ftime(s), 3), end=round(ftime(e), 3), midi=21 + k,
                          peak=round(float(x[s:e].max()), 3), onset=round(float(ons), 3)))
notes.sort(key=lambda n: (n['start'], n['midi']))
json.dump(notes, open(a.out, 'w'), indent=0)
print(len(notes), 'notes:', sum(n['layer'] == 'slow' for n in notes), 'slow,', sum(n['layer'] == 'fast' for n in notes), 'fast')

if a.png:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    times = ftime(np.arange(F))
    p = 0.0; pg = 0; end = times[-1]
    while p < end:
        q = min(end, p + a.page); fr = slice(*np.searchsorted(times, [p, q]))
        fig, ax = plt.subplots(figsize=(26, 12), dpi=72)
        ax.imshow(N[fr].T, origin='lower', aspect='auto', cmap='magma', vmin=0, vmax=1, extent=[p, q, 20.5, 108.5])
        ax.set_ylim(28.5, 90.5)
        ax.set_yticks(range(29, 91)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(29, 91)], fontsize=6)
        for m in range(29, 91): ax.axhline(m - 0.5, color='w', lw=0.2, alpha=0.3)
        for n in notes:
            if n['end'] < p or n['start'] > q: continue
            col = '#4da6ff' if n['layer'] == 'slow' else '#00ff99'
            ax.add_patch(plt.Rectangle((n['start'], n['midi'] - 0.42), n['end'] - n['start'], 0.84, fill=False, ec=col, lw=1.1 if n['layer'] == 'fast' else 1.6))
        ax.set_xticks(np.arange(np.ceil(p), q + 0.01, 1)); ax.tick_params(axis='x', labelsize=7); ax.grid(axis='x', alpha=0.25)
        ax.set_xlim(p, q); ax.set_title(f'basic-pitch note posterior {p:.0f}-{q:.0f} s: slow layer (blue), fast layer (green)')
        plt.tight_layout(); plt.savefig(f'{a.png}_{pg:02d}.png'); plt.close(fig)
        p = q; pg += 1
