"""A first look at a record: its loudness every second (printed per 5 s), where the music
starts and ends, left/right correlation, side-to-mid level and left-minus-right lean per
octave, constant-Q pictures in 30 s pages tuned to the record's pitch, and the four strongest
pitch classes every 10 s.

usage: first_look.py record48.wav cents out_dir
"""
import sys
import numpy as np, soundfile as sf, scipy.signal as ss, librosa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
src, cents, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
x, sr = sf.read(src); m = x.mean(1)
rms = np.array([10 * np.log10(np.mean(x[i:i + sr] ** 2) + 1e-20) for i in range(0, len(x) - sr, sr)])
print('loudness per second (dBFS, both channels’ mean square), rows of 5 s:')
for i in range(0, len(rms), 5):
    print(f'{i // 60}:{i % 60:02d} ' + ' '.join(f'{v:6.1f}' for v in rms[i:i + 5]))
nz = np.where(np.abs(m) > 10 ** (-70 / 20))[0]
print(f'music from {nz[0] / sr:.2f} to {nz[-1] / sr:.2f} s')
print('per octave: L/R correlation, side minus mid, left minus right:')
for lo in [63, 125, 250, 500, 1000, 2000, 4000, 8000]:
    y = ss.sosfilt(ss.butter(4, [lo / np.sqrt(2), lo * np.sqrt(2)], 'bp', fs=sr, output='sos'), x, axis=0)
    mid, side = (y[:, 0] + y[:, 1]) / 2, (y[:, 0] - y[:, 1]) / 2
    print(f'  {lo:5d} Hz {np.corrcoef(y[:, 0], y[:, 1])[0, 1]:.2f}  {10 * np.log10(np.mean(side ** 2) / np.mean(mid ** 2)):5.1f} dB  '
          f'{10 * np.log10(np.mean(y[:, 0] ** 2) / np.mean(y[:, 1] ** 2)):+.1f} dB')
y22 = librosa.resample(m, orig_sr=sr, target_sr=22050)
C = librosa.amplitude_to_db(np.abs(librosa.cqt(y22, sr=22050, hop_length=256, fmin=librosa.note_to_hz('A0'),
    n_bins=88 * 3, bins_per_octave=36, tuning=cents / 100)), ref=np.max)
fr = 22050 / 256; dur = len(m) / sr
for t0 in range(0, int(dur), 30):
    fig, ax = plt.subplots(figsize=(24, 10)); a0, a1 = int(t0 * fr), int(min(t0 + 30, dur) * fr)
    ax.imshow(C[:, a0:a1], origin='lower', aspect='auto', vmin=-70, vmax=0, cmap='magma',
              extent=[t0, t0 + (a1 - a0) / fr, 21 - 1 / 3, 21 + 88 - 1 / 3])
    ax.set_yticks(range(24, 108, 12)); ax.set_yticklabels([f'C{k // 12 - 1}' for k in range(24, 108, 12)])
    ax.set_ylim(28, 100); ax.set_xticks(np.arange(t0, t0 + 31, 1)); ax.grid(color='w', lw=0.2)
    fig.savefig(f'{out}/cqt_{t0:03d}.png', dpi=60, bbox_inches='tight'); plt.close(fig)
ch = librosa.feature.chroma_cqt(y=y22, sr=22050, hop_length=512, tuning=cents / 100)
names = 'C C# D D# E F F# G G# A A# B'.split(); f10 = int(10 * 22050 / 512)
print('strongest pitch classes per 10 s:')
for i in range(0, ch.shape[1], f10):
    v = ch[:, i:i + f10].mean(1); o = np.argsort(v)[::-1][:4]
    print(f'  {int(i / f10 * 10) // 60}:{int(i / f10 * 10) % 60:02d} ' + ' '.join(f'{names[k]}({v[k]:.2f})' for k in o))
