"""The CS-80's notes, first draft: the fast layer's notes (layers.py) from A3 up - below that
its notes are the pad's swells, the bass and the low booms - less the flicker a held pad key
shows: a note on a key the slow layer holds must have a real attack or a strong peak.

That test also throws out long legato lead notes (the slow layer holds every key held for 2 s
or more), so `--keep` lists fast-layer notes ([start, midi]) kept whatever the tests say:
lead_keep.json holds the ones that brought the record's picture closer when rendered back in
(each note's own stretch, harmonics 1-8, by more than 0.5 dB).

usage: lead_notes.py layers.json out.json [--keep lead_keep.json]
"""
import argparse, json

ap = argparse.ArgumentParser(); ap.add_argument('layers'); ap.add_argument('out')
ap.add_argument('--keep', help='[[start, midi], ...]: fast-layer notes kept whatever the tests say')
a = ap.parse_args()
notes = json.load(open(a.layers))
keep = {(round(s, 3), m) for s, m in json.load(open(a.keep))} if a.keep else set()
slow = [n for n in notes if n['layer'] == 'slow']
LOWEST = 57  # A3


def overlap(a, b):
    return max(0.0, min(a['end'], b['end']) - max(a['start'], b['start']))


out = []
for n in notes:
    if n['layer'] != 'fast':
        continue
    if (round(n['start'], 3), n['midi']) not in keep:
        if n['midi'] < LOWEST:
            continue
        held = sum(overlap(n, s) for s in slow if s['midi'] == n['midi'])
        if held > 0.5 * (n['end'] - n['start']) and (n['peak'] < 0.75 or n['onset'] < 0.45):
            continue
    out.append(dict(part='cs80', start=n['start'], end=n['end'], midi=n['midi'], peak=n['peak'], onset=n['onset']))
json.dump(sorted(out, key=lambda n: (n['start'], n['midi'])), open(a.out, 'w'), indent=0)
print(len(out), 'CS-80 notes,', sum((round(n['start'], 3), n['midi']) in keep for n in out), 'of them kept by the list')
