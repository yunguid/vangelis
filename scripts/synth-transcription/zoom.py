"""High-resolution pitch picture of a short span: CQT at 5 bins/semitone, 2.5 ms hop, dB.
usage: zoom.py audio.wav out.png t0 t1 [--lo E3] [--hi C7] [--tuning 11.6] [--floor 55] [--notes lead.json]"""
import argparse, json, numpy as np, soundfile as sf, librosa, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('out'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('--lo', default='E3'); ap.add_argument('--hi', default='C7'); ap.add_argument('--tuning', type=float, default=11.6)
ap.add_argument('--floor', type=float, default=55); ap.add_argument('--notes')
a = ap.parse_args()
info = sf.info(a.audio); sr = info.samplerate
pad = 1.0
s0 = max(0, int((a.t0 - pad) * sr)); s1 = min(info.frames, int((a.t1 + pad) * sr))
x, _ = sf.read(a.audio, start=s0, stop=s1, dtype='float32')
if x.ndim > 1: x = x.mean(axis=1)
BPS = 5; lo = librosa.note_to_midi(a.lo); hi = librosa.note_to_midi(a.hi)
fmin = librosa.midi_to_hz(lo) * 2 ** (a.tuning / 1200) * 2 ** (-2 / (BPS * 12))
hop = 128
C = np.abs(librosa.cqt(x, sr=sr, hop_length=hop, fmin=fmin, n_bins=(hi - lo) * BPS + BPS, bins_per_octave=12 * BPS, filter_scale=1.0))
D = librosa.amplitude_to_db(C, ref=np.max(C))
t = s0 / sr + np.arange(C.shape[1]) * hop / sr
sel = (t >= a.t0) & (t <= a.t1)
axis = lo - 2 / BPS + np.arange(C.shape[0]) / BPS
fig, ax = plt.subplots(figsize=(max(10, (a.t1 - a.t0) * 2.2), (hi - lo) * 0.2 + 1.5), dpi=90)
ax.imshow(D[:, sel], origin='lower', aspect='auto', cmap='magma', vmin=-a.floor, vmax=0, extent=[t[sel][0], t[sel][-1], axis[0], axis[-1]], interpolation='nearest')
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
for m in range(lo, hi + 1):
    ax.axhline(m, color='w', lw=0.3, alpha=0.2 if '#' in names[m % 12] else 0.35)
    if names[m % 12] == 'C': ax.axhline(m - 0.5, color='#00e5ff', lw=0.8, alpha=0.6)
ax.set_yticks(range(lo, hi + 1)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(lo, hi + 1)], fontsize=7)
ticks = np.arange(np.ceil(a.t0 * 10) / 10, a.t1, 0.1)
ax.set_xticks(ticks); ax.set_xticklabels([f'{v:.1f}' if abs(v * 2 - round(v * 2)) < 1e-6 else '' for v in ticks], fontsize=7)
for v in ticks: ax.axvline(v, color='w', lw=0.6 if abs(v - round(v)) < 1e-6 else 0.2, alpha=0.3)
if a.notes:
    for n in json.load(open(a.notes)):
        if n['end'] < a.t0 or n['start'] > a.t1: continue
        ax.add_patch(plt.Rectangle((n['start'], n['midi'] - 0.4), n['end'] - n['start'], 0.8, fill=False, ec='#00ff99', lw=1))
ax.set_title(f'{a.t0}-{a.t1} s, CQT 5 bins/semitone, dB (floor -{a.floor})', fontsize=9)
plt.tight_layout(); plt.savefig(a.out)
