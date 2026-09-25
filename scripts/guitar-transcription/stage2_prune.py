"""Stage 2: the page's release, then prune and add notes.

Picks the release time (the page's exponential ramp at a note's end) that fits best,
re-fits how notes stop, drops notes whose removal costs nothing (and single-model notes
worth under 20), and adds notes at detected plucks that lower the cost by more than 150.

usage: stage2_prune.py features.pkl stage1.pkl onsets.json stage2.pkl
"""
import json
import pickle
import sys
import time

import numpy as np

from model import FRAME_SECONDS, OPEN, Model
from refine import (add_pass, apply, damp_pass, dyn_pass, removal_costs, removal_move, set_natural_ends,
                    string_pass, tilt_pass)

features_path, fit_path, onsets_path, out = sys.argv[1:5]
P = pickle.load(open(features_path, 'rb'))
M = Model.resume(P, pickle.load(open(fit_path, 'rb')))
onsets = np.array([o['t'] for o in json.load(open(onsets_path))]) * P['sr'] / P['hop']
start = time.time()


def report(tag):
    print(f'{tag:28s} {M.summary()}  [{time.time() - start:.0f}s]', flush=True)


report('stage 1')
costs = {}
for release in (0.02, 0.035, 0.05, 0.07, 0.1, 0.15, 0.25):
    M.release_frames = release / FRAME_SECONDS
    M.build()
    costs[release] = M.cost()
    print(f'   release {release:.3f} s: cost {costs[release]:.0f}', flush=True)
M.release_frames = min(costs, key=costs.get) / FRAME_SECONDS
M.build(); report(f'release {min(costs, key=costs.get)} s')
damp_pass(M); tilt_pass(M); M.fit_gains(iters=8); report('stops, brightness')

cost = removal_costs(M)
drop = [n for n, c in zip(list(M.notes), cost) if c < 0 or (n['votes'] <= 1 and c < 20)]
for n in sorted(drop, key=lambda n: n['t']):
    olds, news = removal_move(M, n)
    apply(M, olds, news)
    if news:
        olds[1].update(news[0])
    M.notes.remove(n)
set_natural_ends(M); M.fit_gains(iters=8); report(f'pruned {len(drop)}')

added = add_pass(M, onsets, OPEN, penalty=150, max_add=200)
for n in M.notes:
    n.setdefault('votes', 0)
    n.setdefault('tilt', 0)
set_natural_ends(M); M.fit_gains(iters=8); report(f'added {added}')
damp_pass(M); tilt_pass(M); dyn_pass(M); M.fit_gains(iters=8); report('stops, brightness, take')
changed = string_pass(M, OPEN, penalty=20); set_natural_ends(M); M.fit_gains(iters=8); report(f'strings ({changed})')
damp_pass(M); M.fit_gains(iters=8); report('stops')
pickle.dump(M.state(), open(out, 'wb'))
