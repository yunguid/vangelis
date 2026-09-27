"""Width per octave: left/right correlation and left-minus-right level, record against
render(s), over a span.

usage: width.py record.wav render.wav [...] --span t0,t1
"""
import sys
import numpy as np, soundfile as sf, scipy.signal as ss
span = [float(v) for v in sys.argv[sys.argv.index('--span') + 1].split(',')]
files = [a for a in sys.argv[1:] if a.endswith('.wav')]
print('octave     ' + ' '.join(f'{b:>11d}' for b in [63, 125, 250, 500, 1000, 2000, 4000, 8000]))
for p in files:
    x, sr = sf.read(p); x = x[int(span[0] * sr): int(span[1] * sr)]
    cs, bs = [], []
    for lo in [63, 125, 250, 500, 1000, 2000, 4000, 8000]:
        y = ss.sosfilt(ss.butter(4, [lo / np.sqrt(2), lo * np.sqrt(2)], 'bp', fs=sr, output='sos'), x, axis=0)
        cs.append(np.corrcoef(y[:, 0], y[:, 1])[0, 1]); bs.append(10 * np.log10(np.mean(y[:, 0] ** 2) / np.mean(y[:, 1] ** 2)))
    print(f'{p.split("/")[-1][:10]:10s} ' + ' '.join(f'{c:5.2f}/{b:+5.1f}' for c, b in zip(cs, bs)))
