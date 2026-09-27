"""A constant-Q picture of the record (tuned to its own pitch) with note lists drawn over it:
the first list as outlined boxes (onset to offset), the others as onset marks. This is how
notes were checked by eye.

usage: overlay.py audio.wav cents t0 t1 out.png notes.json [more.json ...] [--pitch lo,hi] [--dpi 50]
"""
import json, sys, numpy as np, soundfile as sf, librosa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
src, cents, t0, t1, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
x, sr = sf.read(src, always_2d=True); y = x.mean(1)[int(t0 * sr): int(t1 * sr)]
y = librosa.resample(y, orig_sr=sr, target_sr=22050)
C = librosa.amplitude_to_db(np.abs(librosa.cqt(y, sr=22050, hop_length=128, fmin=librosa.note_to_hz('A0'),
    n_bins=88 * 3, bins_per_octave=36, tuning=cents / 100)), ref=np.max)
fig, ax = plt.subplots(figsize=(26, 12))
ax.imshow(C, origin='lower', aspect='auto', vmin=-65, vmax=0, cmap='gray_r',
          extent=[t0, t1, 21 - 1 / 3, 21 + 88 - 1 / 3])
colors = ['tab:red', 'tab:blue', 'tab:green']
for k, path in enumerate([a for a in sys.argv[6:] if a.endswith('.json')]):
    for n in json.load(open(path))['notes']:
        if n['off'] < t0 or n['on'] > t1: continue
        if k == 0:
            ax.add_patch(plt.Rectangle((n['on'], n['pitch'] - 0.4), n['off'] - n['on'], 0.8, fill=False,
                         ec=colors[k], lw=0.8 + n.get('vel', 64) / 60))
        else:
            ax.plot(n['on'], n['pitch'] + 0.3 * k, 'o', ms=4, color=colors[k % 3])
names = 'C C# D D# E F F# G G# A A# B'.split()
lo, hi = [int(v) for v in (sys.argv[sys.argv.index('--pitch') + 1].split(',') if '--pitch' in sys.argv else (28, 104))]
ax.set_yticks(range(lo, hi)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(lo, hi)], fontsize=9)
ax.set_ylim(lo, hi); ax.set_xticks(np.arange(np.ceil(t0), t1, 0.5)); ax.grid(color='tab:orange', lw=0.15)
fig.savefig(out, dpi=int(sys.argv[sys.argv.index('--dpi') + 1]) if '--dpi' in sys.argv else 50, bbox_inches='tight')
