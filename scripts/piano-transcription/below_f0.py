"""What sounds under a note's own fundamental. For each clear onset of a note from C5 up
(nothing else starting within 0.3 s before or 0.5 s after), the rise in power below 0.8 f0
(40 Hz up) against the rise at the fundamental, 0-60 ms after the onset (the hammer's knock
through the body) and 100-400 ms after (the body and room ringing on), in the record and in a
render of the same notes. An acoustic grand heard through air microphones carries its knock
and soundboard there; a pickup, or a close microphone on the strings, much less.

usage: below_f0.py record.wav render.wav notes.json cents [--span t0,t1]
"""
import json, sys
import numpy as np, soundfile as sf

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def spec(x, sr, t0, t1):
    seg = x[max(0, int(t0 * sr)): int(t1 * sr)]
    return np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 15)) ** 2 / len(seg), np.fft.rfftfreq(1 << 15, 1 / sr)

def main():
    rec, sr = sf.read(sys.argv[1]); ren, _ = sf.read(sys.argv[2]); rec, ren = rec.mean(1), ren.mean(1)
    notes = json.load(open(sys.argv[3]))['notes']; cents = float(sys.argv[4])
    t0, t1 = [float(v) for v in option('--span', '0,1e9').split(',')]
    ons = np.array(sorted(n['on'] for n in notes))
    rows = []
    for n in notes:
        if n['pitch'] < 72 or not (t0 <= n['on'] < t1): continue
        if ((ons > n['on'] - 0.3) & (ons < n['on'] + 0.5)).sum() > 1: continue
        f0 = 440 * 2 ** ((n['pitch'] - 69 + cents / 100) / 12)
        out = []
        for x in (rec, ren):
            pre, f = spec(x, sr, n['on'] - 0.06, n['on'])
            vals = []
            for a, b in [(0, 0.06), (0.1, 0.4)]:
                S, _ = spec(x, sr, n['on'] + a, n['on'] + b)
                d = np.maximum(S - pre, 0)
                low = d[(f >= 40) & (f < 0.8 * f0)].sum(); fund = d[(f > f0 * 0.97) & (f < f0 * 1.03)].sum()
                vals.append(10 * np.log10((low + 1e-20) / (fund + 1e-20)))
            out.append(vals)
        rows.append((n['pitch'], n['on'], *out[0], *out[1]))
    r = np.array(rows)
    print(f'{len(r)} clear notes from C5 up; energy under 0.8 f0 against the fundamental, dB (median):')
    print(f'  knock 0-60 ms:   record {np.median(r[:, 2]):+.1f}  render {np.median(r[:, 4]):+.1f}')
    print(f'  ring 100-400 ms: record {np.median(r[:, 3]):+.1f}  render {np.median(r[:, 5]):+.1f}')
    for lo, hi in [(72, 84), (84, 109)]:
        m = (r[:, 0] >= lo) & (r[:, 0] < hi)
        if m.any(): print(f'  midi {lo}-{hi - 1} (n={m.sum()}): knock {np.median(r[m, 2]):+.1f} vs {np.median(r[m, 4]):+.1f}, ring {np.median(r[m, 3]):+.1f} vs {np.median(r[m, 5]):+.1f}')

if __name__ == '__main__':
    main()
