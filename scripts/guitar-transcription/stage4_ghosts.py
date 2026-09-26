"""Stage 4: the thumb's ghost strokes.

At the record's plucks that a render of the transcription does not reproduce
(compare.py --unmatched), tries a heavily muted stroke (15-30 ms decay) of every pitch on
every free string and keeps the ones the audio supports (cost reduction above --penalty).

usage: stage4_ghosts.py features.pkl stage3.pkl unmatched.json stage4.pkl --cents 41.7 [--penalty 40]
"""
import json
import pickle
import sys
import time

import numpy as np

from model import FRAME_SECONDS, OPEN, Model
from refine import add_pass, dyn_pass, set_natural_ends, tilt_pass


def option(name, default):
    return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


features_path, fit_path, unmatched_path, out = sys.argv[1:5]
penalty = option('--penalty', 40)
speed = 2 ** (float(sys.argv[sys.argv.index('--cents') + 1]) / 1200)   # the record's timeline runs this much faster
M = Model.resume(pickle.load(open(features_path, 'rb')), pickle.load(open(fit_path, 'rb')))
set_natural_ends(M)
M.build()
start = time.time()


def report(tag):
    print(f'{tag:28s} {M.summary()}  [{time.time() - start:.0f}s]', flush=True)


report('stage 3')
plucks = np.array(json.load(open(unmatched_path))) * speed / FRAME_SECONDS
before = len(M.notes)
added = add_pass(M, plucks, OPEN, penalty=penalty, max_add=300, mute_options=(1.5, 3.0), pitch_range=(40, 80))
for n in M.notes[before:]:
    n.update(ghost=True, votes=0)
    n.setdefault('tilt', 0)
set_natural_ends(M); M.fit_gains(iters=8, fit_H=False); report(f'ghost strokes +{added}')
tilt_pass(M); dyn_pass(M); M.fit_gains(iters=6, fit_H=False); report('brightness, take')
ghosts = [n for n in M.notes if n.get('ghost')]
print('ghost strokes by string:', {s: sum(1 for n in ghosts if n['s'] == s) for s in range(1, 7)})
pickle.dump(M.state(), open(out, 'wb'))
