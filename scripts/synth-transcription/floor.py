"""The steady floor under the music: per octave, the mean over its STFT bins of each bin's
quietest moments (5th percentile within 2 s blocks, median over blocks), for the record and
a render over the same span. Built to set the noise bed (makeRecordNoise) to the record's.

usage: floor.py record.wav render.wav t0 t1 [--offset render_start]
"""
import sys
import numpy as np
import soundfile as sf
from scipy.signal import stft


def floor(path, a, b):
    x, sr = sf.read(path, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    f, _, Z = stft(x[int(a * sr):int(b * sr)], sr, nperseg=4096, noverlap=2048)
    P = np.abs(Z) ** 2; blk = int(2 * sr / 2048)
    Q = np.median([np.percentile(P[:, i:i + blk], 5, axis=1) for i in range(0, P.shape[1] - blk, blk)], axis=0)
    return f, 10 * np.log10(Q + 1e-20)


t0, t1 = float(sys.argv[3]), float(sys.argv[4])
off = float(sys.argv[sys.argv.index('--offset') + 1]) if '--offset' in sys.argv else 0.0
f, R = floor(sys.argv[1], t0, t1); _, M = floor(sys.argv[2], t0 - off, t1 - off)
for c in (100, 200, 400, 800, 1600, 3200, 6400, 12800):
    s = (f >= c / 1.41) & (f < c * 1.41)
    print(f'{c:6d} Hz: record {np.mean(R[s]):6.1f} dB, render {np.mean(M[s]):6.1f} dB')
