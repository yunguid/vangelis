"""What kind of piano is this? Inharmonicity and decay rate by register, measured the same
way on the record's exposed notes and on reference recordings (Salamander: a Yamaha C5 grand).

- Inharmonicity: a stiff string's partial n sits at n f0 sqrt(1 + B n^2). Each partial is
  found as the strongest peak in a window that allows B up to 0.02, 0.15-0.65 s after the
  onset (a 0.5 s Hann FFT, zero-padded 8x, parabolic interpolation), and B is fitted to
  (f_n / n f0)^2 = 1 + B n^2 by least squares with f0 free. Grands measure B of about 1e-4 to
  4e-4 in the bass; short-stringed instruments (uprights, electric grands like the CP-80)
  several times more.
- Decay: the level of the note's first four partials (narrow bands) from 0.2 to 1.5 s after
  the onset, as a straight-line fit in dB/s.

usage: instrument_tests.py record.wav notes.json cents [--ref dir]   (notes: run_bytedance.py
       output; reference files named like A2v8.flac)
"""
import json, sys, glob, os, numpy as np, soundfile as sf
NAMES = 'C C# D D# E F F# G G# A A# B'.split()

def midi_of(name):
    n, o = (name[:2], name[2:]) if name[1] == '#' else (name[:1], name[1:])
    return NAMES.index(n) + 12 * (int(o) + 1)

def partials(x, sr, t0, f0, nmax=16):
    """Partials tracked outwards: f0 and B are refitted after each partial, and partial n is
    looked for within 25 cents of where the current fit puts it."""
    seg = x[int((t0 + 0.15) * sr): int((t0 + 0.65) * sr)]
    if len(seg) < int(0.5 * sr) - 1: return None
    N = len(seg) * 8
    S = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); df = sr / N
    out, fc, B = [], f0, 0.0
    for n in range(1, nmax + 1):
        pred = n * fc * np.sqrt(1 + B * n * n)
        lo, hi = pred * 2 ** (-(40 if n == 1 else 25) / 1200), pred * 2 ** (25 / 1200)
        a, b = int(lo / df), int(hi / df) + 1
        if b >= len(S) - 1: break
        k = a + int(np.argmax(S[a:b]))
        ref = np.median(S[max(0, int(pred * 0.9 / df)): int(pred * 1.1 / df)])
        if k in (a, b - 1) or S[k] < ref * 6: continue    # no clear peak inside the window
        y0, y1, y2 = np.log(S[k - 1: k + 2] + 1e-12)
        off = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
        out.append((n, (k + off) * df, 20 * np.log10(S[k] + 1e-12)))
        if len(out) >= 3:
            fit = fit_B(out, f0, raw=True)
            if fit: fc, B = fit
        elif n == 1:
            fc = out[0][1]
    return out

def fit_B(pk, f0, raw=False):
    if len(pk) < (3 if raw else 6): return None
    n = np.array([p[0] for p in pk], float); f = np.array([p[1] for p in pk])
    # f_n^2 = f0'^2 n^2 + f0'^2 B n^4  -> linear in (n^2, n^4)
    A = np.stack([n ** 2, n ** 4], 1); c, *_ = np.linalg.lstsq(A, f ** 2, rcond=None)
    if c[0] <= 0: return None
    B = max(c[1] / c[0], 0.0) if raw else c[1] / c[0]
    return (np.sqrt(c[0]), B) if raw else (B, 0)

def decay(x, sr, t0, f0):
    w = int(0.05 * sr); ts, lv = [], []
    for t in np.arange(t0 + 0.2, t0 + 1.5, 0.05):
        seg = x[int(t * sr): int(t * sr) + w]
        if len(seg) < w: break
        S = np.abs(np.fft.rfft(seg * np.hanning(w), 8 * w)); df = sr / (8 * w)
        e = sum(S[int(n * f0 * 0.98 / df): int(n * f0 * 1.03 / df) + 1].max() ** 2 for n in range(1, 5))
        ts.append(t - t0); lv.append(10 * np.log10(e + 1e-20))
    if len(ts) < 10: return None
    return np.polyfit(ts, lv, 1)[0]

if __name__ == '__main__':
    rec, notes_path, cents = sys.argv[1], sys.argv[2], float(sys.argv[3])
    x, sr = sf.read(rec); x = x.mean(1) if x.ndim > 1 else x
    notes = json.load(open(notes_path))['notes']
    ons = np.array(sorted(n['on'] for n in notes))
    rows = []
    for nt in notes:
        if nt['pitch'] > 72: continue
        near = ons[(ons > nt['on'] - 0.3) & (ons < nt['on'] + 0.7)]
        if len(near) > 1: continue                     # another note starts too close
        f0 = 440 * 2 ** ((nt['pitch'] - 69 + cents / 100) / 12)
        pk = partials(x, sr, nt['on'], f0); fb = fit_B(pk, f0) if pk else None
        dc = decay(x, sr, nt['on'], f0)
        if fb: rows.append((nt['pitch'], nt['on'], nt['vel'], fb[0], len(pk), dc))
    print('record: isolated notes (pitch, onset, vel, B, partials found, decay dB/s)')
    for r in sorted(rows):
        print(f'  {NAMES[r[0] % 12]}{r[0] // 12 - 1:<3} {r[1]:7.2f}s v{r[2]:<3} B {r[3]:.2e} ({r[4]:2d})  decay {r[5] if r[5] is None else round(r[5], 1)}')
    for lo, hi in [(21, 40), (40, 52), (52, 64), (64, 73)]:
        sel = [r for r in rows if lo <= r[0] < hi and r[3] > 0]
        if sel: print(f'  midi {lo}-{hi - 1}: median B {np.median([r[3] for r in sel]):.2e}  median decay {np.median([r[5] for r in sel if r[5] is not None]):.1f} dB/s  (n={len(sel)})')
    if '--ref' in sys.argv:
        d = sys.argv[sys.argv.index('--ref') + 1]
        print('reference:')
        for f in sorted(glob.glob(os.path.join(d, '*.flac')), key=lambda p: midi_of(os.path.basename(p).split('v')[0])):
            y, rs = sf.read(f); y = y.mean(1) if y.ndim > 1 else y
            onset = np.argmax(np.abs(y) > np.abs(y).max() * 0.1) / rs
            m = midi_of(os.path.basename(f).split('v')[0]); f0 = 440 * 2 ** ((m - 69) / 12)
            pk = partials(y, rs, onset, f0); fb = fit_B(pk, f0) if pk else None
            dc = decay(y, rs, onset, f0)
            print(f'  {os.path.basename(f):12s} B {fb[0] if fb else float("nan"):.2e} ({len(pk) if pk else 0:2d})  decay {dc:.1f} dB/s')
