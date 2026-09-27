"""The glide cluster as a part: its pitch curve (cluster_track.py's path, a 0.5 s median) and
where it sounds (its salience, smoothed over 1 s, over LO dB; gaps under 6 s bridged, since
the salience dips where the glide turns and its lines stand still against the 3 s median), at
one level within each span with 1 s fades at its edges (the record's fan is as bright at its
turns as elsewhere, so the salience does not set its level), with each semitone line's level from the record's
spectrum along the path (smoothed over five semitones, the loudest at 0 dB), for make_midi.py
--glides.

`--span-db` sets each span's level in turn (dB), from a render compared with the record on the
comb lines (0:03-0:58 at -8.7, 3:15-3:36 at -2.2, 4:02 to the end at 0 on this record).

`--fade t0,t1` fades the cluster out, linearly in dB to -40 dB, from t0 to t1, and ends it
there. Tried on 4:44-4:58, where the record's fan dies away into single sine arches while the
tracker's path wanders on; not used: the record holds -40 dBFS of fan and arches there, and a
replica silent in that stretch took the loudness contour's correlation from 0.846 to 0.733.

usage: cluster_notes.py cluster.json out.json [--lo 2] [--span-db -8.7,-2.2,0] [--fade 284.5,298]
"""
import json, sys
import numpy as np, scipy.ndimage as nd

def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

d = json.load(open(sys.argv[1]))
hop = d['hop']; t = np.array(d['times']); cents = np.array(d['cents']); sal = np.array(d['salience'])
lo = float(option('--lo', 2))
pitch = nd.median_filter(cents, size=int(round(0.5 / hop)) | 1)
s = nd.uniform_filter1d(sal, size=int(round(1 / hop)))
fade_from, fade_to = [float(v) for v in option('--fade', '1e9,1e9').split(',')]
present = nd.binary_closing(s >= lo, structure=np.ones(int(round(6 / hop)))) & (t < fade_to)
fade = int(round(1 / hop))
ramp = np.minimum(nd.distance_transform_edt(present), fade) / fade      # 0..1 over the first and last second
level_db = np.where(present, 20 * np.log10(np.maximum(ramp, 1e-3)), -120)
edges = np.flatnonzero(np.diff(np.r_[0, present.astype(int), 0]))
for k, (a, b) in enumerate(zip(edges[::2], edges[1::2])):
    offsets = [float(v) for v in option('--span-db', '').split(',') if v]
    if k < len(offsets): level_db[a:b] += offsets[k]
if option('--fade'):
    level_db = np.where(present & (t > fade_from), level_db - 40 * np.clip((t - fade_from) / (fade_to - fade_from), 0, 1), level_db)
line = nd.uniform_filter1d(np.array(d['line_db']), size=5, mode='nearest'); line = line - line.max()
json.dump({'rate': 1 / hop, 'start': float(t[0]), 'cents': pitch.round(1).tolist(), 'level_db': level_db.round(1).tolist(),
           'notes': [{'midi': int(m), 'db': float(v)} for m, v in zip(d['mids'], line)]}, open(sys.argv[2], 'w'))
on = level_db > -120
print(f'sounding {on.mean() * 100:.0f}% of the time; spans:',
      [(round(float(t[a]), 1), round(float(t[b - 1]), 1)) for a, b in zip(*[np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0]) == k) for k in (1, -1)]) if t[b - 1] - t[a] > 1])
