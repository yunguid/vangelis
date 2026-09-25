"""The CS-80's notes, first draft: the fast layer's notes (layers.py) from A3 up - below that
its notes are the pad's swells, the bass and the low booms - less the flicker a held pad key
shows: a note on a key the slow layer holds must have a real attack or a strong peak.

usage: lead_notes.py layers.json out.json
"""
import json, sys

notes = json.load(open(sys.argv[1]))
slow = [n for n in notes if n['layer'] == 'slow']
LOWEST = 57  # A3


def overlap(a, b):
    return max(0.0, min(a['end'], b['end']) - max(a['start'], b['start']))


out = []
for n in notes:
    if n['layer'] != 'fast' or n['midi'] < LOWEST:
        continue
    held = sum(overlap(n, s) for s in slow if s['midi'] == n['midi'])
    if held > 0.5 * (n['end'] - n['start']) and (n['peak'] < 0.75 or n['onset'] < 0.45):
        continue
    out.append(dict(part='cs80', start=n['start'], end=n['end'], midi=n['midi'], peak=n['peak'], onset=n['onset']))
json.dump(sorted(out, key=lambda n: (n['start'], n['midi'])), open(sys.argv[2], 'w'), indent=0)
print(len(out), 'CS-80 notes')
