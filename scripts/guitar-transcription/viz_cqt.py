"""Pitch-grid spectrogram pages: a tuning-compensated CQT (3 bins/semitone) drawn
against a note grid, optionally with transcribed notes overlaid.
usage: viz_cqt.py audio.wav out_prefix --start 0 --end 10 --page 5 [--notes notes.json] [--tuning 41.7]"""
import argparse, json, numpy as np, soundfile as sf, librosa, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ap = argparse.ArgumentParser()
ap.add_argument('audio'); ap.add_argument('out')
ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=None)
ap.add_argument('--page', type=float, default=5); ap.add_argument('--tuning', type=float, default=41.7)
ap.add_argument('--lo', default='C2'); ap.add_argument('--hi', default='C7')
ap.add_argument('--notes'); ap.add_argument('--pxs', type=float, default=220)
ap.add_argument('--floor', type=float, default=60)
ap.add_argument('--marks')
a = ap.parse_args()

x, sr = sf.read(a.audio, dtype='float32')
if x.ndim > 1: x = x.mean(axis=1)
end = a.end or len(x) / sr
BPS = 3  # bins per semitone
lo, hi = librosa.note_to_midi(a.lo), librosa.note_to_midi(a.hi)
fmin = librosa.midi_to_hz(lo) * 2 ** (a.tuning / 1200) * 2 ** (-1 / (BPS * 12))  # centre bin on the note
hop = 256
n_bins = (hi - lo) * BPS + BPS
pad = int(1.0 * sr)
s0 = max(0, int(a.start * sr) - pad); s1 = min(len(x), int(end * sr) + pad)
C = np.abs(librosa.cqt(x[s0:s1], sr=sr, hop_length=hop, fmin=fmin, n_bins=n_bins, bins_per_octave=12 * BPS, filter_scale=1.5))
D = librosa.amplitude_to_db(C, ref=np.max(C))
t = s0 / sr + np.arange(C.shape[1]) * hop / sr
midi_axis = lo - 1 / BPS + np.arange(n_bins) / BPS

notes = json.load(open(a.notes)) if a.notes else []
STRING_COLORS = {1: '#ff4d4d', 2: '#ffa64d', 3: '#ffff4d', 4: '#4dff4d', 5: '#4dd2ff', 6: '#b84dff', None: '#ffffff'}
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
p = a.start; k = 0
while p < end - 1e-6:
    q = min(end, p + a.page)
    sel = (t >= p) & (t <= q)
    w = max(6, (q - p) * a.pxs / 100); h = (hi - lo) * 0.16 + 1.2
    fig, ax = plt.subplots(figsize=(w, h), dpi=100)
    ax.imshow(D[:, sel], origin='lower', aspect='auto', cmap='magma', vmin=-a.floor, vmax=0,
              extent=[t[sel][0], t[sel][-1], midi_axis[0] - 0.5 / BPS, midi_axis[-1] + 0.5 / BPS], interpolation='nearest')
    for m in range(lo, hi + 1):
        c = names[m % 12]
        ax.axhline(m - 0.5, color='#ffffff', lw=0.25 if '#' in c else 0.5, alpha=0.18 if '#' in c else 0.35)
        if c == 'C': ax.axhline(m - 0.5, color='#00e5ff', lw=0.8, alpha=0.6)
    ax.set_yticks(range(lo, hi + 1)); ax.set_yticklabels([f'{names[m%12]}{m//12-1}' for m in range(lo, hi + 1)], fontsize=6)
    ticks = np.arange(np.ceil(p * 4) / 4, q + 1e-6, 0.25)
    ax.set_xticks(ticks); ax.set_xticklabels([f'{v:.2f}' if abs(v * 2 - round(v * 2)) < 1e-6 else '' for v in ticks], fontsize=7)
    for v in ticks: ax.axvline(v, color='#ffffff', lw=0.3 if abs(v - round(v)) > 1e-6 else 0.8, alpha=0.25)
    for n in notes:
        if n['end'] < p or n['start'] > q: continue
        col = STRING_COLORS.get(n.get('string'))
        ax.add_patch(plt.Rectangle((n['start'], n['midi'] - 0.45), n['end'] - n['start'], 0.9, fill=False, ec=col, lw=1.0))
        label = n.get('label') or (f"{n['string']}/{n['fret']}" if n.get('string') else '')
        if label: ax.text(n['start'] + 0.005, n['midi'] + 0.5, label, color=col, fontsize=6, va='bottom')
    if a.marks:
        for mt in json.load(open(a.marks)):
            if p <= mt <= q: ax.axvline(mt, color='#00ff88', lw=1.2, alpha=0.9, ls='--')
    ax.set_xlim(p, q); ax.set_ylim(lo - 0.5, hi + 0.5)
    ax.set_title(f'{a.audio}  {p:.2f}-{q:.2f} s  (tuning {a.tuning:+.1f} c, CQT {BPS} bins/semitone, dB re max)', fontsize=8)
    fig.tight_layout()
    fig.savefig(f'{a.out}_{k:03d}.png'); plt.close(fig)
    print(f'{a.out}_{k:03d}.png'); p = q; k += 1
