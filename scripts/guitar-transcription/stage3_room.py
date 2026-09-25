"""Stage 3: the room, then the release under it, then how each note stops.

Grid-searches the room's tail (level against the dry note, and its time constant), then the
release time the page uses at a note's end, and re-fits every note's stop, brightness, take
and the per-pitch timbre under them.

usage: stage3_room.py features.pkl stage2.pkl stage3.pkl
"""
import pickle
import sys
import time

from model import FRAME_SECONDS, Model
from refine import damp_pass, dyn_pass, set_natural_ends, tilt_pass

features_path, fit_path, out = sys.argv[1:4]
M = Model.resume(pickle.load(open(features_path, 'rb')), pickle.load(open(fit_path, 'rb')))
M.release_frames = 0.05 / FRAME_SECONDS
set_natural_ends(M)
M.build()
start = time.time()


def report(tag):
    print(f'{tag:28s} {M.summary()}  [{time.time() - start:.0f}s]', flush=True)


report('stage 2, release 50 ms')
rooms = {}
for level in (0.0, 0.02, 0.05, 0.1, 0.18, 0.3):
    for seconds in ((0.05,) if level == 0 else (0.05, 0.1, 0.2, 0.35, 0.6)):
        M.room_level, M.room_frames = level, seconds / FRAME_SECONDS
        M.fit_gains(iters=3, fit_H=False, fit_N=False)
        rooms[(level, seconds)] = M.cost()
        print(f'   room level {level:.2f}, time constant {seconds:.2f} s: cost {rooms[(level, seconds)]:.0f}', flush=True)
level, seconds = min(rooms, key=rooms.get)
M.room_level, M.room_frames = level, seconds / FRAME_SECONDS
M.fit_gains(iters=8); report(f'room {level}, {seconds} s (RT60 {6.91 * seconds:.2f} s)')

releases = {}
for release in (0.02, 0.035, 0.05, 0.07, 0.1, 0.15):
    M.release_frames = release / FRAME_SECONDS
    M.build()
    releases[release] = M.cost()
    print(f'   release {release:.3f} s: cost {releases[release]:.0f}', flush=True)
M.release_frames = min(releases, key=releases.get) / FRAME_SECONDS
M.build(); report(f'release {min(releases, key=releases.get)} s')
for round_ in range(2):
    damp_pass(M); tilt_pass(M); M.fit_gains(iters=6); report(f'stops, brightness {round_}')
dyn_pass(M); M.fit_gains(iters=6); report('take')
M.adapt_E(iters=2); damp_pass(M); M.fit_gains(iters=6); report('timbre per pitch, stops')
pickle.dump(M.state(), open(out, 'wb'))
