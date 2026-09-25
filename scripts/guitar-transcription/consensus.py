"""Pairwise agreement between transcriptions and a vote-based consensus.
Notes match when pitch is equal and onsets are within TOL; the consensus keeps each note cluster
with its median onset, the number of models that found it, and which ones.

usage: consensus.py name1,name2,... consensus.json   (reads name.json note lists from the
       working directory; list the three QMUL runs first and basic-pitch last)
"""
import json, sys, numpy as np, itertools
names = sys.argv[1].split(','); out = sys.argv[2]
sets = {n: json.load(open(f'{n}.json')) for n in names}
def match(a, b, tol):
    used = set(); m = []
    bi = {}
    for j, y in enumerate(b): bi.setdefault(y['midi'], []).append(j)
    for i, x in enumerate(a):
        best, bd = None, tol
        for j in bi.get(x['midi'], []):
            if j in used: continue
            d = abs(b[j]['start'] - x['start'])
            if d <= bd: best, bd = j, d
        if best is not None: used.add(best); m.append((i, best, b[best]['start'] - x['start']))
    return m
short = {n: n.split('/')[-1] for n in names}
for tol in (0.05, 0.02):
    for a, b in itertools.combinations(names, 2):
        m = match(sets[a], sets[b], tol)
        p, r = len(m) / len(sets[a]), len(m) / len(sets[b])
        dt = np.array([x[2] for x in m]) * 1000
        print(f'tol {tol*1000:.0f} ms  {short[a]:>45s} vs {short[b]:<45s} F1 {2*p*r/(p+r):.3f}  (median dt {np.median(dt):+.1f} ms, IQR {np.percentile(dt,25):+.1f}..{np.percentile(dt,75):+.1f})')
# consensus: cluster by pitch + onset proximity (50 ms)
allnotes = []
for k, n in enumerate(names):
    for x in sets[n]: allnotes.append(dict(x, src=k))
allnotes.sort(key=lambda x: (x['midi'], x['start']))
clusters = []
for x in allnotes:
    c = clusters[-1] if clusters else None
    if c and c['midi'] == x['midi'] and x['start'] - c['starts'][-1] <= 0.05 and x['src'] not in c['srcs']:
        c['starts'].append(x['start']); c['ends'].append(x['end']); c['srcs'].append(x['src'])
    else:
        clusters.append(dict(midi=x['midi'], starts=[x['start']], ends=[x['end']], srcs=[x['src']]))
cons = [dict(midi=c['midi'], start=float(np.median(c['starts'])), end=float(np.median(c['ends'])), votes=len(set(c['srcs'])), srcs=sorted(set(c['srcs']))) for c in clusters]
cons.sort(key=lambda x: (x['start'], x['midi']))
json.dump(cons, open(out, 'w'))
v = np.array([c['votes'] for c in cons])
print('consensus clusters', len(cons), {k: int((v == k).sum()) for k in range(1, len(names) + 1)})
