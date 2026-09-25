"""Active RMS and peak of one or more renders (for matching a piece's level to the others).

usage: loudness.py a.wav [b.wav ...]
"""
import soundfile as sf, numpy as np, sys
for f in sys.argv[1:]:
    x, sr = sf.read(f); x = x.mean(axis=1) if x.ndim > 1 else x
    w = int(0.4 * sr); k = len(x) // w
    r = 10 * np.log10(np.mean(x[:k * w].reshape(k, w) ** 2, axis=1) + 1e-20)
    act = r > r.max() - 40
    print(f"{f.split('/')[-1]:28s} active RMS {10 * np.log10(np.mean(10 ** (r[act] / 10))):6.1f} dBFS, peak {20 * np.log10(np.abs(x).max()):6.1f} dBFS")
