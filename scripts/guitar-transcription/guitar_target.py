"""The guitar a band recording's fit explains: its guitar stem, plus other stems only where they
hold guitar (a stem@t0-t1 argument counts between those seconds, with 50 ms fades). Demucs puts
part of a solo guitar's thumb bass in its bass stem; once a bass player comes in, that stem is
theirs. Writes a mono float WAV.

usage: guitar_target.py out.wav guitar.wav [bass.wav@0-32.6 ...]
"""
import sys, numpy as np, soundfile as sf
out = None
for arg in sys.argv[2:]:
    path, _, span = arg.partition('@')
    x, sr = sf.read(path, dtype='float64', always_2d=True)
    x = x.mean(axis=1)
    if span:
        t0, t1 = (float(v) for v in span.split('-'))
        gate = np.zeros(len(x)); a, b = int(t0 * sr), min(len(x), int(t1 * sr)); gate[a:b] = 1
        fade = np.linspace(0, 1, int(0.05 * sr))
        if a > 0: gate[a:a + len(fade)] = fade
        if b < len(x): gate[b - len(fade):b] = fade[::-1]
        x = x * gate
    out = x if out is None else out + x
sf.write(sys.argv[1], out.astype(np.float32), sr, subtype='FLOAT')
print(sys.argv[1], f'{len(out) / sr:.2f} s')
