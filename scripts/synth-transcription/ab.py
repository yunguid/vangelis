"""Record over render: two CQT pictures (3 bins/semitone) of the same span, same scale.
usage: ab.py record.wav render.wav out.png t0 t1 [--lo F#1] [--hi G6] [--offset 0 (render time = record time - offset)]"""
import argparse, numpy as np, soundfile as sf, librosa, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
ap = argparse.ArgumentParser(); ap.add_argument('rec'); ap.add_argument('ren'); ap.add_argument('out'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('--lo', default='F#1'); ap.add_argument('--hi', default='G6'); ap.add_argument('--tuning', type=float, default=11.6); ap.add_argument('--offset', type=float, default=0)
a = ap.parse_args()
BPS = 3; lo = librosa.note_to_midi(a.lo); hi = librosa.note_to_midi(a.hi)
fmin = librosa.midi_to_hz(lo) * 2 ** (a.tuning / 1200) * 2 ** (-1 / (BPS * 12))
def cqt(path, t0, t1):
    info = sf.info(path); sr = info.samplerate
    x, _ = sf.read(path, start=max(0, int(t0 * sr)), stop=min(info.frames, int(t1 * sr)), dtype='float32')
    x = x.mean(axis=1) if x.ndim > 1 else x
    C = np.abs(librosa.cqt(x, sr=sr, hop_length=480, fmin=fmin, n_bins=(hi - lo) * BPS + BPS, bins_per_octave=12 * BPS))
    return 20 * np.log10(C + 1e-9), sr
A, sr = cqt(a.rec, a.t0, a.t1); B, _ = cqt(a.ren, a.t0 - a.offset, a.t1 - a.offset)
ref = max(np.percentile(A, 99.9), np.percentile(B, 99.9))
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
fig, axs = plt.subplots(2, 1, figsize=(max(12, (a.t1 - a.t0) * 0.9), (hi - lo) * 0.2 + 2), dpi=80, sharex=True)
for ax, M, title in ((axs[0], A, 'record'), (axs[1], B, 'render')):
    n = M.shape[1]
    ax.imshow(M, origin='lower', aspect='auto', cmap='magma', vmin=ref - 60, vmax=ref, extent=[a.t0, a.t0 + n * 480 / sr, lo - 1 / 3, hi + 1 / 3])
    ax.set_yticks(range(lo, hi + 1, 2)); ax.set_yticklabels([f'{names[m % 12]}{m // 12 - 1}' for m in range(lo, hi + 1, 2)], fontsize=6)
    ax.set_title(f'{title} {a.t0}-{a.t1} s (same dB scale)', fontsize=9)
axs[1].set_xticks(np.arange(np.ceil(a.t0), a.t1, 1)); axs[1].tick_params(axis='x', labelsize=7)
plt.tight_layout(); plt.savefig(a.out)
