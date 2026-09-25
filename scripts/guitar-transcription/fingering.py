"""Initial fingering: onset groups (notes within 35 ms) get distinct strings, higher pitch on a
higher string, frets near a tracked hand position (open strings free)."""
import itertools, numpy as np
from model import OPEN
MAXF = 15
def positions(midi):
    return [(s, midi - OPEN[s]) for s in range(1, 7) if 0 <= midi - OPEN[s] <= MAXF]
def assign(notes, hand=2.0, group_s=0.035):
    notes = sorted(notes, key=lambda n: (n['time'], -n['midi']))
    i = 0
    while i < len(notes):
        j = i
        while j < len(notes) and notes[j]['time'] - notes[i]['time'] < group_s: j += 1
        grp = sorted(notes[i:j], key=lambda n: -n['midi'])
        # drop duplicate pitches within a group
        best, bestc = None, 1e9
        opts = [positions(n['midi']) for n in grp]
        if all(opts) and len(grp) <= 6:
            for combo in itertools.product(*opts):
                ss = [c[0] for c in combo]
                if len(set(ss)) < len(ss): continue
                if any(ss[k] > ss[k + 1] for k in range(len(ss) - 1)): continue  # higher pitch on lower-numbered string
                fr = [c[1] for c in combo if c[1] > 0]
                span = (max(fr) - min(fr)) if fr else 0
                if span > 4: continue
                c = sum(abs(f - hand) for f in fr) + 3 * span
                if c < bestc: best, bestc = combo, c
        if best is None:  # fall back: each note independently
            best = [min(o, key=lambda p: abs(p[1] - hand) if p[1] else 0) if o else (None, None) for o in opts]
        for n, (s, f) in zip(grp, best):
            n['s'], n['f'] = s, f
        fr = [f for (s, f) in best if f]
        if fr: hand = 0.7 * hand + 0.3 * np.mean(fr)
        i = j
    return [n for n in notes if n.get('s')]
