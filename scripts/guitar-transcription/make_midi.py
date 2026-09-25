"""A fitted transcription -> a guitar-performance MIDI file on the record's own timeline and pitch.

The fit lives on the speed-corrected timeline at A440 (speed_correct.py); the file plays as the
record sounds, `--cents` above A440 and that much faster. Velocity is each stroke's modelled
attack energy (its first 60 ms, dry, through the recording channel) at 25 dB per decade, with
the loudest 1% of strokes at 127. `--loudness` applies closed-loop corrections measured by
calibrate.py (one or more rounds, comma-separated; at most 4 dB per round and note).

usage: make_midi.py features.pkl fit.pkl beats.json out.mid [--loudness a.json,b.json] [--cents 41.7]
"""
import json
import pickle
import sys

import numpy as np

from export_midi import export
from model import FRAME_SECONDS, Model

VELOCITY_DB_PER_DECADE = 25.0


def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def note_key(n):
    return f"{n['t']:.2f}:{n['midi']}:{n['s']}"


features_path, fit_path, beats_path, out = sys.argv[1:5]
cents = float(option('--cents', 41.7))
speed = 2 ** (cents / 1200)
M = Model.resume(pickle.load(open(features_path, 'rb')), pickle.load(open(fit_path, 'rb')))
M.room_level = 0.0  # loudness is the dry stroke's
notes = M.notes

levels = []
for n in notes:
    s0, B = M.block(n)
    k = int(n['t']) - s0
    levels.append(10 * np.log10(np.sum((B[:, max(0, k):k + 6] * M.H * n['g']) ** 2) + 1e-20))
levels = np.array(levels)
if option('--loudness'):
    keys = [note_key(n) for n in notes]
    for path in option('--loudness').split(','):
        by_key = json.load(open(path))['note_error_by_key']
        # notes added since that round was measured have no correction yet
        levels -= np.clip([by_key.get(k, 0.0) for k in keys], -4, 4)
velocity = np.clip(10 ** ((levels - np.percentile(levels, 99)) / VELOCITY_DB_PER_DECADE), 1 / 127, 1.0)

performance = []
for n, v in zip(notes, velocity):
    t = n['t'] * FRAME_SECONDS / speed
    end = n['end'] * FRAME_SECONDS / speed if n.get('end') is not None else t + 4.0
    performance.append(dict(
        time=t, end=max(end, t + 0.03), midi=n['midi'], string=n['s'], velocity=int(np.clip(round(v * 127), 1, 127)),
        take=n['d'], tilt=n.get('tilt', 0), mute_s=n['mute'] * FRAME_SECONDS / speed if n.get('mute') else None))
beats = np.array(json.load(open(beats_path))['beats']) / speed
export(performance, beats, out, cents, 'Pernambuco (Luiz Bonfá, 1959)',
       'Transcribed from Luiz Bonfá, Solo in Rio 1959 (Smithsonian Folkways SFW40483); strings = channels')
takes = {d: sum(1 for p in performance if p['take'] == d) for d in ('pp', 'mf', 'ff')}
print(f'{out}: {len(performance)} notes; velocity 5/50/95%: {np.percentile([p["velocity"] for p in performance], [5, 50, 95])}; '
      f'muted {sum(1 for p in performance if p["mute_s"])}; takes {takes}')
