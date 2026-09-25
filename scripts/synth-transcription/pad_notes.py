"""Pad notes from the NMF activations: each pitch's activation, smoothed over half a second,
is a note wherever it stays within FLOOR dB of the loudest pad note for at least MIN s (gaps
under GAP s bridged); the note keeps its activation as its loudness curve (20 Hz, dB re its
own peak) and its peak, re the loudest, as its level.

usage: pad_notes.py pad_nmf.npz expr.json out.json [--floor 24] [--min 1.5] [--gap 0.8]
out.json: expr.json's cs80 notes plus the pad notes (part 'pad', with `curve`)
"""
import argparse, json
import numpy as np
from scipy.ndimage import uniform_filter1d

ap = argparse.ArgumentParser(); ap.add_argument('nmf'); ap.add_argument('expr'); ap.add_argument('out')
ap.add_argument('--floor', type=float, default=24); ap.add_argument('--min', type=float, default=1.5); ap.add_argument('--quiet', type=float, default=38); ap.add_argument('--gap', type=float, default=0.8)
a = ap.parse_args()
z = np.load(a.nmf); A = z['A'].astype(float); t = z['t']; pitches = z['pitches']
dt = t[1] - t[0]
S = uniform_filter1d(A, size=max(1, int(round(0.5 / dt))), axis=1)
from scipy.ndimage import maximum_filter1d
# the pad's loudness moves over the piece: a note is judged against the loudest pad note
# within 8 s either side (and never below 50 dB under the loudest of all)
ref = np.percentile(S.max(axis=0), 99.5)
local = maximum_filter1d(S.max(axis=0), size=int(round(16 / dt)))
thr = np.maximum(local * 10 ** (-a.floor / 20), ref * 10 ** (-50 / 20))
notes = []
for pi, p in enumerate(pitches):
    on = S[pi] > thr
    runs = []; i = 0; F = len(on)
    while i < F:
        if on[i]:
            j = i
            while j < F and on[j]: j += 1
            runs.append([i, j]); i = j
        else:
            i += 1
    merged = []
    for r in runs:
        if merged and (r[0] - merged[-1][1]) * dt < a.gap: merged[-1][1] = r[1]
        else: merged.append(r)
    for s, e in merged:
        if (e - s) * dt < a.min: continue
        seg = S[pi, s:e]; peak = seg.max()
        # 20 Hz loudness curve (the NMF frames are 50 ms)
        db = 20 * np.log10(np.maximum(seg, peak * 1e-3) / peak)
        notes.append(dict(part='pad', midi=int(p), start=round(float(t[s]), 3), end=round(float(t[e - 1] + dt), 3),
                          level=round(float(20 * np.log10(peak / ref)), 1),
                          curve=dict(t0=round(float(t[s]), 3), rate=round(1 / dt, 3), db=[round(float(v), 1) for v in db])))
cs = [n for n in json.load(open(a.expr)) if n.get('part') == 'cs80']
# what is left of a CS-80 note in the room is not a pad note: none on (or a semitone from)
# a CS-80 note's pitch while it sounds or rings (3 s), and none too quiet to hear (QUIET dB)
def lead_residue(n):
    for c in cs:
        on = c.get('onset', c['start']); off = min(c['end'], c.get('offset', c['end'])) + 3.0
        if abs(c['midi'] - n['midi']) <= 1 and n['start'] < off and n['end'] > on - 0.3 and n['start'] > on - 0.5:
            return True
    return False
before = len(notes)
notes = [n for n in notes if n['level'] >= -a.quiet and not lead_residue(n)]
print(f'dropped {before - len(notes)} of {before}: quiet or CS-80 residue')
json.dump(cs + sorted(notes, key=lambda n: (n['start'], n['midi'])), open(a.out, 'w'))
dur = np.array([n['end'] - n['start'] for n in notes]); lv = np.array([n['level'] for n in notes])
print(len(notes), 'pad notes; durations 10/50/90%', np.percentile(dur, [10, 50, 90]).round(1), 'levels 10/50/90%', np.percentile(lv, [10, 50, 90]).round(1))
print('most simultaneous:', max(sum(1 for n in notes if n['start'] <= x < n['end']) for x in np.arange(0, t[-1], 0.5)))
