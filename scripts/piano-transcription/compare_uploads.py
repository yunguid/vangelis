"""Two uploads of the same record: align them (cross-correlation over the first minute) and
compare level, left/right correlation, the spectrum per band against 0.5-2 kHz, and the floor
above 7 kHz (quietest tenth of 50 ms windows), to keep the one with less damage.

usage: compare_uploads.py a48.wav b48.wav
"""
import sys
import numpy as np, soundfile as sf, scipy.signal as ss
a, sr = sf.read(sys.argv[1]); b, _ = sf.read(sys.argv[2])
n = sr * 60
c = ss.correlate(b[:n].mean(1), a[:n].mean(1), mode='full', method='fft')
lag = int(np.argmax(c)) - (n - 1)
print(f'{sys.argv[2]} runs {lag / sr * 1000:+.1f} ms against {sys.argv[1]}')
aa, bb = (a, b[lag:]) if lag >= 0 else (a[-lag:], b)
L = min(len(aa), len(bb)); aa, bb = aa[:L], bb[:L]
for name, x in [(sys.argv[1], aa), (sys.argv[2], bb)]:
    f, P = ss.welch(x.mean(1), sr, nperseg=8192)
    band = lambda lo, hi: 10 * np.log10(P[(f >= lo) & (f < hi)].mean() + 1e-30)
    ref = band(500, 2000)
    h = ss.sosfilt(ss.butter(8, 7000, 'hp', fs=sr, output='sos'), x.mean(1)); w = int(0.05 * sr)
    e = h[: len(h) // w * w].reshape(-1, w); e = (e ** 2).mean(1)
    print(f'{name}: peak {20 * np.log10(np.abs(x).max()):.2f} dBFS, mean square {10 * np.log10(np.mean(x ** 2)):.2f} dB, '
          f'L/R correlation {np.corrcoef(x[:, 0], x[:, 1])[0, 1]:.3f}, floor above 7 kHz {10 * np.log10(np.percentile(e, 10) + 1e-30):.1f} dB')
    print('   against 0.5-2 kHz: ' + ' '.join(f'{lo // 1000}-{hi // 1000} kHz {band(lo, hi) - ref:.1f}' for lo, hi in
          [(8000, 12000), (12000, 16000), (16000, 18000), (18000, 20000), (20000, 22000)]))
