"""The piano score shared by the scripts here, with the rule the page plays it by
(src/data/memoriesOfGreen.js keeps the same rule; change both together):

- a note sounds from its key-down until its key-up, or, if the sustain pedal is down then,
  until the pedal comes up;
- a key struck again while its string still sounds cuts the earlier note at the new strike;
- the damper then takes RELEASE seconds to stop the string (the page's release).

Samples: Salamander Grand V3 (a Yamaha C5) is recorded every minor third, A0 to C8; a note
plays from the recording nearest its pitch, never more than a semitone and a half away.
"""
import json
import numpy as np

RELEASE = 0.3
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
POSITIONS = [21 + 3 * k for k in range(30)]          # A0, C1, D#1 ... A7, C8


def name_of(midi):
    return f'{NAMES[midi % 12]}{midi // 12 - 1}'


def file_name(midi):
    return name_of(midi).replace('#', 's')


def position_of(midi):
    return min(POSITIONS, key=lambda p: (abs(p - midi), p))


def sounding(notes, pedal):
    """End of each note's sound (before the damper's release), as a list aligned with notes."""
    spans = sorted((p['on'], p['off']) for p in pedal)
    def pedal_up_after(t):
        for a, b in spans:
            if a <= t < b: return b
        return t
    ends = [max(n['off'], pedal_up_after(n['off'])) for n in notes]
    order = sorted(range(len(notes)), key=lambda i: notes[i]['on'])
    last = {}
    for i in order:
        p = notes[i]['pitch']
        if p in last and ends[last[p]] > notes[i]['on']:
            ends[last[p]] = notes[i]['on']
        last[p] = i
    return ends


def load(path):
    d = json.load(open(path))
    return d['notes'], d.get('pedal', [])
