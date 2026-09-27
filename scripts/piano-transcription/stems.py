"""What each Demucs stem holds: its level against the mix per 15 s and its left/right
correlation, and constant-Q pictures of chosen stems over a span (tuned to the record's pitch).

usage: stems.py record44.wav sep_dir cents [t0 t1 out.png stem,stem,...]
       (sep_dir holds htdemucs_6s_<stem>.wav; "mix" names the record itself)
"""
import sys
import numpy as np, soundfile as sf, librosa
rec_p, sep, cents = sys.argv[1], sys.argv[2], float(sys.argv[3])
x, sr = sf.read(rec_p); seg = int(15 * sr)
for s in ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']:
    y, _ = sf.read(f'{sep}/htdemucs_6s_{s}.wav')
    lv = [10 * np.log10(np.mean(y[i:i + seg] ** 2) / np.mean(x[i:i + seg] ** 2) + 1e-12) for i in range(0, len(x) - seg, seg)]
    print(f'{s:7s} {10 * np.log10(np.mean(y ** 2) / np.mean(x ** 2)):6.1f} dB of the mix, L/R {np.corrcoef(y[:, 0], y[:, 1])[0, 1]:.2f}, per 15 s:',
          ' '.join(f'{v:4.0f}' for v in lv))
if len(sys.argv) > 4:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    t0, t1, out, names = float(sys.argv[4]), float(sys.argv[5]), sys.argv[6], sys.argv[7].split(',')
    fig, axs = plt.subplots(len(names), 1, figsize=(24, 5.5 * len(names)))
    for ax, s in zip(np.atleast_1d(axs), names):
        y, _ = sf.read(rec_p if s == 'mix' else f'{sep}/htdemucs_6s_{s}.wav')
        y = librosa.resample(y.mean(1)[int(t0 * sr):int(t1 * sr)], orig_sr=sr, target_sr=22050)
        C = librosa.amplitude_to_db(np.abs(librosa.cqt(y, sr=22050, hop_length=256, fmin=librosa.note_to_hz('A0'),
            n_bins=88 * 3, bins_per_octave=36, tuning=cents / 100)), ref=1.0)
        ax.imshow(C, origin='lower', aspect='auto', vmin=-90, vmax=-15, cmap='magma', extent=[t0, t1, 21 - 1 / 3, 21 + 88 - 1 / 3])
        ax.set_ylim(28, 104); ax.set_title(s); ax.set_xticks(np.arange(t0, t1, 1)); ax.grid(color='w', lw=0.2)
    fig.savefig(out, dpi=45, bbox_inches='tight')
