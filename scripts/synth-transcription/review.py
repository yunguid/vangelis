"""Review pages: CQT (3 bins/semitone, tuning-compensated) with a score's notes on it,
coloured by part. One CQT pass for the whole file; pages written in parallel-friendly loop.
usage: review.py audio.wav notes.json out_prefix [--page 20] [--lo F#1] [--hi G6] [--start 0] [--end N]"""
import argparse, json, numpy as np, soundfile as sf, librosa, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('notes'); ap.add_argument('out')
ap.add_argument('--page', type=float, default=20); ap.add_argument('--lo', default='F#1'); ap.add_argument('--hi', default='G6')
ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=None)
ap.add_argument('--tuning', type=float, default=11.6); ap.add_argument('--floor', type=float, default=60)
a = ap.parse_args()
x, sr = sf.read(a.audio, dtype='float32')
if x.ndim > 1: x = x.mean(axis=1)
end = a.end or len(x) / sr
BPS = 3; lo = librosa.note_to_midi(a.lo); hi = librosa.note_to_midi(a.hi)
fmin = librosa.midi_to_hz(lo) * 2 ** (a.tuning / 1200) * 2 ** (-1 / (BPS * 12))
hop = 480
s0 = int(max(0, a.start - 1) * sr); s1 = int(min(len(x) / sr, end + 1) * sr)
C = np.abs(librosa.cqt(x[s0:s1], sr=sr, hop_length=hop, fmin=fmin, n_bins=(hi - lo) * BPS + BPS, bins_per_octave=12 * BPS, filter_scale=1.0))
D = librosa.amplitude_to_db(C, ref=np.max(C))
t = s0 / sr + np.arange(C.shape[1]) * hop / sr
axis = lo - 1 / BPS + np.arange(C.shape[0]) / BPS
notes = json.load(open(a.notes))
COL = {'cs80': '#00ff66', 'pad': '#4da6ff', 'bass': '#ff66ff', 'keys': '#ffdd00'}
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
p = a.start; k = 0
while p < end - 1e-6:
    q = min(end, p + a.page); sel = (t >= p) & (t <= q)
    fig, ax = plt.subplots(figsize=(max(12, (q - p) * 1.3), (hi - lo) * 0.16 + 1.2), dpi=80)
    ax.imshow(D[:, sel], origin='lower', aspect='auto', cmap='magma', vmin=-a.floor, vmax=0, extent=[t[sel][0], t[sel][-1], axis[0] - 1 / 6, axis[-1] + 1 / 6], interpolation='nearest')
    for m in range(lo, hi + 1):
        ax.axhline(m - 0.5, color='w', lw=0.2, alpha=0.15 if '#' in names[m % 12] else 0.3)
        if names[m % 12] == 'C': ax.axhline(m - 0.5, color='#00e5ff', lw=0.8, alpha=0.5)
    ax.set_yticks(range(lo, hi + 1)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(lo, hi + 1)], fontsize=6)
    ax.set_xticks(np.arange(np.ceil(p), q + 1e-6, 1)); ax.tick_params(axis='x', labelsize=7)
    for v in np.arange(np.ceil(p * 2) / 2, q, 0.5): ax.axvline(v, color='w', lw=0.2 if v % 1 else 0.5, alpha=0.25)
    for i, n in enumerate(notes):
        if n['end'] < p or n['start'] > q or not (lo <= n['midi'] <= hi): continue
        c = COL.get(n.get('part'), '#ffffff')
        ax.add_patch(plt.Rectangle((n['start'], n['midi'] - 0.45), n['end'] - n['start'], 0.9, fill=False, ec=c, lw=1.1))
        if n.get('part') == 'cs80': ax.text(n['start'], n['midi'] + 0.5, str(i), color=c, fontsize=6)
    ax.set_xlim(p, q)
    ax.set_title(f'{p:.0f}-{q:.0f} s: record CQT with the score (green cs80 with index, blue pad)', fontsize=9)
    plt.tight_layout(); plt.savefig(f'{a.out}_{k:02d}.png'); plt.close(fig)
    p = q; k += 1
print(k, 'pages')
