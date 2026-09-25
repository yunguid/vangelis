"""Split the University of Iowa MIS guitar files (Guitar.mono.2496.zip: 24-bit/96 kHz, one mic)
into single takes: string, fret and dynamic (pp/mf/ff).

Each file plays a run of semitones on one string at one dynamic. Per take: onset-aligned audio
at 44.1 kHz (3 ms pre-roll, up to the next take, 10 s at most, a 4th-order 60 Hz high-pass
against the chamber's rumble), its tuning in cents from equal temperament (from its first four
partials), its level over the first 250 ms and the noise before it.

As a script: iowa.py <dir with the .aif files> takes.pkl
"""
import os
import pickle
import re
import subprocess
import sys

import numpy as np

SR = 44100; HOP = 441
OPEN = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}
SNAME = {'sul_E': 1, 'sulB': 2, 'sulG': 3, 'sulD': 4, 'sulA': 5, 'sulE': 6}
SEMI = dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)
def note_num(n):
    m = re.match(r'([A-G])(b?)(\d)', n); return (int(m[3]) + 1) * 12 + SEMI[m[1]] - (1 if m[2] else 0)
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-af', 'highpass=f=60,highpass=f=60', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def envelope(x):
    n = len(x) // HOP; return np.sqrt((x[:n * HOP].reshape(n, HOP) ** 2).mean(axis=1))
def plucks(env, floor):
    out = []; f = 0
    while f < len(env) - 4:
        if out and f - out[-1] < 100: f += 1; continue
        after = env[f:f + 4].max(); before = env[f - 6] if f >= 6 else 0; jb = env[f - 2] if f >= 2 else 0
        if after > floor and after > before * 4 and env[f] > jb * 2:
            p = f
            for k in range(f, min(len(env), f + 100)):
                if env[k] > env[p]: p = k
            loud = env[p]
            while p > 0 and env[p - 1] > loud * 0.1: p -= 1
            # a click before an edited gap is not a pluck: a real note still sounds 100-200 ms on
            if env[p + 10:p + 20].mean() < env[p:p + 5].max() * 0.01:
                f += 1; continue
            out.append(p); f = max(f + 1, p + 100); continue
        f += 1
    return out
def cents_off(x, start, midi):
    size = 1 << 16; seg = x[start + int(0.08 * SR): start + int(0.08 * SR) + size]
    seg = np.pad(seg, (0, size - len(seg))) * np.hanning(size)
    S = np.abs(np.fft.rfft(seg)); f0 = 440 * 2 ** ((midi - 69) / 12); ws = 0; wf = 0
    for h in range(1, 5):
        lo, hi = int(f0 * h * 0.955 * size / SR), int(f0 * h * 1.045 * size / SR)
        b = lo + np.argmax(S[lo:hi]); a_, b_, c_ = np.log(S[b - 1:b + 2] + 1e-12)
        fr = (b + 0.5 * (a_ - c_) / (a_ - 2 * b_ + c_)) * SR / size
        wf += S[b] * fr / h; ws += S[b]
    return 1200 * np.log2(wf / ws / f0)
def load_takes(SRC, keys=None):
    """{(string, fret, dyn): take} for the Iowa guitar files under SRC. With `keys` (a set of
    (string, fret, dyn)), only the files holding those takes are decoded."""
    takes = {}
    for fn in sorted(os.listdir(SRC)):
        # one file is misspelt upstream ("Guiatr.pp.sulB.B3.aif")
        m = re.match(r'Gui(?:tar|atr)\.(pp|mf|ff)\.(sul_?[EABDG])\.([A-G]b?\d)([A-G]b?\d)?\.aif$', fn)
        if not m: continue
        dyn, s, lo = m[1], SNAME[m[2]], note_num(m[3]); hi = note_num(m[4]) if m[4] else lo
        if keys is not None and not any((s, midi - OPEN[s], dyn) in keys for midi in range(lo, hi + 1)): continue
        x = load(os.path.join(SRC, fn)); env = envelope(x)
        floor = 0.002 if dyn == 'pp' else 0.004
        ps = plucks(env, floor)
        if len(ps) != hi - lo + 1:
            # retry with other floors before giving up
            for fl in (0.001, 0.003, 0.006, 0.008, 0.0005):
                ps = plucks(env, fl)
                if len(ps) == hi - lo + 1: break
        if len(ps) != hi - lo + 1:
            print(f'iowa: {fn}: found {len(ps)} plucks, expected {hi - lo + 1}; its takes are left out', file=sys.stderr)
            continue
        for i, p in enumerate(ps):
            midi = lo + i; fret = midi - OPEN[s]
            start = p * HOP; nxt = ps[i + 1] * HOP - 5 * HOP if i + 1 < len(ps) else len(x)
            pk = np.abs(x[start:start + int(0.05 * SR)]).max()
            on = max(0, start - 3 * HOP)
            while abs(x[on]) < pk * 0.05: on += 1
            pre = int(0.003 * SR); a0 = max(0, on - pre)
            audio = x[a0:min(nxt, a0 + 10 * SR)]
            noise = x[max(0, a0 - int(0.4 * SR)):max(0, a0 - int(0.05 * SR))]
            lvl = 20 * np.log10(np.sqrt(np.mean(audio[pre:pre + int(0.25 * SR)] ** 2)) + 1e-12)
            nz = 20 * np.log10(np.sqrt(np.mean(noise ** 2)) + 1e-12) if len(noise) > 100 else np.nan
            takes[(s, fret, dyn)] = dict(audio=audio, cents=cents_off(x, on, midi), level_db=lvl, noise_db=nz, file=fn, midi=midi)
    return takes


if __name__ == '__main__':
    takes = load_takes(sys.argv[1])
    pickle.dump(takes, open(sys.argv[2], 'wb'))
    print(len(takes), 'takes')
