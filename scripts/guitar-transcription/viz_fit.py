"""Observed / modelled / residual CQT pages for an analysis-by-synthesis fit.
usage: viz_fit.py features.pkl fit.pkl out_prefix start end [page]"""
import sys, pickle, numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
sys.path.insert(0, sys.path[0])
from model import Model
P = pickle.load(open(sys.argv[1], 'rb')); FIT = pickle.load(open(sys.argv[2], 'rb'))
out, start, end = sys.argv[3], float(sys.argv[4]), float(sys.argv[5]); page = float(sys.argv[6]) if len(sys.argv) > 6 else 5
fps = P['sr'] / P['hop']
M = Model.resume(P, FIT)
V, Vh = M.V, M.Vh
lo_bin = 0; midi0 = 36; bpo = 36
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
SC = {1: '#ff5050', 2: '#ffa040', 3: '#f0f040', 4: '#40ff60', 5: '#40d0ff', 6: '#c060ff'}
top_midi = 84
nb = (top_midi - midi0) * 3
p = start; k = 0
while p < end - 1e-6:
    q = min(end, p + page)
    a, b = int(p * fps), int(q * fps)
    fig, axs = plt.subplots(3, 1, figsize=(max(8, (q - p) * 2.4), 16), dpi=90, sharex=True)
    ref = np.max(V[:nb, a:b])
    for ax, A, title in ((axs[0], V, 'observed'), (axs[1], Vh, 'model')):
        D = 20 * np.log10(A[:nb, a:b] / ref + 1e-9)
        ax.imshow(D, origin='lower', aspect='auto', cmap='magma', vmin=-55, vmax=0, extent=[p, q, midi0 - 1 / 6, midi0 + nb / 3 - 1 / 6], interpolation='nearest')
        ax.set_title(title, fontsize=9)
    R = 20 * np.log10(V[:nb, a:b] / Vh[:nb, a:b])
    mask = 20 * np.log10(np.maximum(V[:nb, a:b], Vh[:nb, a:b]) / ref) > -45
    axs[2].imshow(np.where(mask, R, 0), origin='lower', aspect='auto', cmap='coolwarm', vmin=-15, vmax=15, extent=[p, q, midi0 - 1 / 6, midi0 + nb / 3 - 1 / 6], interpolation='nearest')
    axs[2].set_title('residual dB (red: recording louder = missing; blue: model louder = extra)', fontsize=9)
    for ax in axs:
        for m in range(midi0, top_midi):
            ax.axhline(m - 0.5, color='w' if ax is not axs[2] else 'k', lw=0.3 if '#' in names[m % 12] else 0.6, alpha=0.25)
        ax.set_yticks(range(midi0, top_midi)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(midi0, top_midi)], fontsize=5.5)
        ticks = np.arange(np.ceil(p * 4) / 4, q + 1e-6, 0.25)
        ax.set_xticks(ticks); ax.set_xticklabels([f'{v:.2f}' if abs(v * 2 - round(v * 2)) < 1e-6 else '' for v in ticks], fontsize=7)
    for n in FIT['notes']:
        t0 = n['t'] / fps; t1 = (n['end'] / fps) if n.get('end') is not None else t0 + 4
        if t1 < p or t0 > q: continue
        for ax in axs[:2]:
            ax.add_patch(plt.Rectangle((t0, n['midi'] - 0.45), min(t1, t0 + 4) - t0, 0.9, fill=False, ec=SC[n['s']], lw=0.8))
        axs[0].text(t0, n['midi'] + 0.5, f"{n['s']}/{n['f']}", color=SC[n['s']], fontsize=5)
    axs[0].set_xlim(p, q)
    fig.tight_layout(); fn = f'{out}_{k:03d}.png'; fig.savefig(fn); plt.close(fig); print(fn)
    p = q; k += 1
