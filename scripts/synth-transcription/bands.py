"""Third-octave band levels (dB, mid channel) of record and render over the same windows.
usage: bands.py record.wav render.wav t0:t1 [t0:t1 ...] [--offset 0]"""
import sys, numpy as np, soundfile as sf
rec, ren = sys.argv[1], sys.argv[2]
spans = [tuple(map(float, s.split(':'))) for s in sys.argv[3:] if ':' in s]
centres = 1000 * 2 ** (np.arange(-17, 14) / 3)  # 20 Hz .. 20 kHz
def bands(path, t0, t1):
    info = sf.info(path); sr = info.samplerate
    x, _ = sf.read(path, start=int(t0 * sr), stop=int(t1 * sr), dtype='float64'); x = x.mean(axis=1) if x.ndim > 1 else x
    N = 16384; w = np.hanning(N)
    P = np.mean([np.abs(np.fft.rfft(x[i:i + N] * w)) ** 2 for i in range(0, len(x) - N, N // 2)], axis=0)
    f = np.fft.rfftfreq(N, 1 / sr)
    return np.array([10 * np.log10(P[(f >= c * 2 ** (-1 / 6)) & (f < c * 2 ** (1 / 6))].sum() + 1e-20) for c in centres])
for t0, t1 in spans:
    A = bands(rec, t0, t1); B = bands(ren, t0, t1)
    tot = lambda v: 10 * np.log10(np.sum(10 ** (v / 10)))
    print(f'{t0:.0f}-{t1:.0f} s: total record {tot(A):.1f} dB, render {tot(B):.1f} dB')
    print('  Hz    ' + ' '.join(f'{c:>6.0f}' for c in centres[3:28]))
    print('  rec   ' + ' '.join(f'{v - tot(A):6.1f}' for v in A[3:28]))
    print('  ren   ' + ' '.join(f'{v - tot(B):6.1f}' for v in B[3:28]))
    print('  diff  ' + ' '.join(f'{(b - tot(B)) - (a - tot(A)):+6.1f}' for a, b in zip(A[3:28], B[3:28])))
