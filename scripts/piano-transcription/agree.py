"""How far two note lists agree: onset F1 with the same pitch, within a tolerance (50 ms by
default), over an optional span; lists the notes only one of them has.

usage: agree.py a.json b.json [--tol 0.05] [--span t0,t1] [--minvel v] [--list]
"""
import json, sys, numpy as np
def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default
tol = float(arg('--tol', 0.05)); span = [float(v) for v in arg('--span', '0,1e9').split(',')]
minvel = float(arg('--minvel', 0))
def load(p):
    return [n for n in json.load(open(p))['notes'] if span[0] <= n['on'] < span[1] and n.get('vel', 127) >= minvel]
A, B = load(sys.argv[1]), load(sys.argv[2])
used = set(); match = []
for i, a in enumerate(A):
    best, bj = tol, None
    for j, b in enumerate(B):
        if j in used or b['pitch'] != a['pitch']: continue
        d = abs(b['on'] - a['on'])
        if d <= best: best, bj = d, j
    if bj is not None: used.add(bj); match.append((i, bj, B[bj]['on'] - a['on']))
p = len(match) / max(1, len(B)); r = len(match) / max(1, len(A))
print(f'{sys.argv[1]}: {len(A)}  {sys.argv[2]}: {len(B)}  matched {len(match)}  '
      f'F1 {2 * p * r / max(1e-9, p + r):.3f}  median offset {1000 * np.median([m[2] for m in match]) if match else 0:+.1f} ms')
if '--list' in sys.argv:
    mi = {m[0] for m in match}
    print('only in A:', [(round(a['on'], 2), a['pitch'], a.get('vel')) for i, a in enumerate(A) if i not in mi][:80])
    print('only in B:', [(round(b['on'], 2), b['pitch']) for j, b in enumerate(B) if j not in used][:80])
