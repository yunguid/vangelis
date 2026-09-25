"""Stage 1: fit the consensus transcription to the recording.

Seeds the model with every note at least one QMUL guitar model found (consensus.py), a
fingering (fingering.py), then fits in turn: gains with the recording channel and noise
floor, the extra decay of upper partials, how each note stops (rings, damped or muted), each
stroke's brightness and take, three rounds of per-pitch timbre correction, and strings.

usage: stage1_consensus.py features.pkl consensus.json stage1.pkl
"""
import json
import pickle
import sys
import time

import numpy as np

from fingering import assign
from model import OPEN, Model
from refine import damp_pass, dyn_pass, fit_alpha, removal_costs, set_natural_ends, string_pass, tilt_pass

features_path, consensus_path, out = sys.argv[1:4]
P = pickle.load(open(features_path, 'rb'))
fps = P['sr'] / P['hop']

# Every note found by at least one of the three QMUL checkpoints (sources 0-2; basic-pitch,
# source 3, only shapes the clusters' onsets). Two notes of one pitch within 60 ms are one.
notes = []
for c in json.load(open(consensus_path)):
    votes = len([s for s in c['srcs'] if s < 3])
    if votes:
        notes.append(dict(time=c['start'], midi=c['midi'], votes=votes))
notes.sort(key=lambda n: (n['midi'], n['time']))
kept = []
for n in notes:
    if kept and kept[-1]['midi'] == n['midi'] and n['time'] - kept[-1]['time'] < 0.06:
        if n['votes'] > kept[-1]['votes']:
            kept[-1] = n
        continue
    kept.append(n)

M = Model.resume(P)
M.notes = assign(kept)
for n in M.notes:
    n.update(t=n['time'] * fps, d='mf', g=0.05, damp=None, mute=None, tilt=0)
set_natural_ends(M)
start = time.time()


def report(tag):
    print(f'{tag:28s} {M.summary()}  [{time.time() - start:.0f}s]', flush=True)


M.fit_gains(iters=25); report('gains, channel, noise')
fit_alpha(M); M.fit_gains(iters=10); report('upper-partial decay')
damp_pass(M); M.fit_gains(iters=10); report('ring / damp / mute')
changed = tilt_pass(M); M.fit_gains(iters=10); report(f'brightness ({changed})')
changed = dyn_pass(M); M.fit_gains(iters=10); report(f'take ({changed})')
for round_ in range(3):
    M.adapt_E(iters=2); report(f'timbre per pitch {round_}')
    damp_pass(M); tilt_pass(M); M.fit_gains(iters=8); report(f'stops, brightness {round_}')
changed = dyn_pass(M); M.fit_gains(iters=8); report(f'take ({changed})')
changed = string_pass(M, OPEN, penalty=20); set_natural_ends(M); M.fit_gains(iters=8); report(f'strings ({changed})')
pickle.dump(M.state(), open(out, 'wb'))

cost = removal_costs(M)
votes = np.array([n['votes'] for n in M.notes])
for v in (1, 2, 3):
    sel = votes == v
    print(f'found by {v} model(s): {sel.sum()} notes; removal cost 5/10/25/50%: '
          f'{np.percentile(cost[sel], [5, 10, 25, 50]).round(0)} ({(cost[sel] < 0).sum()} below zero)')
