"""The transcription as the MIDI file the page plays (src/data/bladeRunnerBlues.js reads it).

Every sounding voice gets a track of its own (a note slot, reused once its note has rung
out), so every note carries its own curves. CS-80 voices are on channels 1-8, one channel
each; pad voices all use channel 13 (a standard player hears them as one channel). A note's
pitch curve is its channel's pitch bend (RPN 0 sets +-12 semitones; for the pad, a steady
bend holding the record's tuning) and its loudness curve is CC 11 (value v is (v - 127) / 2
dB). Curves are cut down to the fewest points whose straight lines stay within PITCH_TOL
cents and LEVEL_TOL dB of the measured ones (the reader draws straight lines between them).
Velocity is the note's peak level. Everything is on the record's own timeline at 120 BPM
(a beat is half a second).

usage: make_midi.py notes.json out.mid [--tuning 11.6] [--release 1.2] [--loudness corrections.json]
"""
import argparse, json, os
import numpy as np
import mido
from scipy.ndimage import median_filter, uniform_filter1d

ap = argparse.ArgumentParser(); ap.add_argument('notes'); ap.add_argument('out')
ap.add_argument('--tuning', type=float, default=11.6); ap.add_argument('--release', type=float, default=1.2)
ap.add_argument('--loudness', help='closed-loop corrections: dB per CS-80 note, keyed by start')
ap.add_argument('--rumble', help='the low bed: rumble_lines.json')
a = ap.parse_args()
TPB = 960; SEC = TPB * 2
BEND_RANGE = 12
PITCH_TOL = 2.0   # cents
LEVEL_TOL = 1.5   # dB
CS80_CHANNELS = 8
PAD_CHANNEL = 12
RUMBLE_CHANNEL = 14


def simplify(t, v, tol):
    """Ramer-Douglas-Peucker: indices of the points a piecewise-linear curve needs."""
    keep = {0, len(v) - 1}
    stack = [(0, len(v) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1: continue
        line = v[i] + (v[j] - v[i]) * (t[i + 1:j] - t[i]) / (t[j] - t[i])
        k = int(np.argmax(np.abs(v[i + 1:j] - line))) + i + 1
        if abs(v[k] - line[k - i - 1]) > tol:
            keep.add(k); stack += [(i, k), (k, j)]
    return sorted(keep)


def smooth(v, width):
    return uniform_filter1d(median_filter(np.asarray(v, float), size=width, mode='nearest'), size=width, mode='nearest')


bend = lambda cents: int(np.clip(round(cents / (BEND_RANGE * 100) * 8192), -8192, 8191))
cc11 = lambda db: int(np.clip(round(127 + 2 * db), 0, 127))
notes = json.load(open(a.notes))
loudness = json.load(open(a.loudness)) if a.loudness else {}
tracks = []  # each: dict(channel, events=[(seconds, order, message)], free_at)


def slot(channel_pool, start):
    for tr in tracks:
        if tr['channel'] in channel_pool and tr['free_at'] <= start:
            return tr
    used = {tr['channel'] for tr in tracks}
    channel = next((c for c in channel_pool if c not in used), channel_pool[-1])
    tr = dict(channel=channel, events=[], free_at=-1.0); tracks.append(tr)
    for num, val in ((101, 0), (100, 0), (6, BEND_RANGE), (38, 0)):
        tr['events'].append((0.0, 0, mido.Message('control_change', channel=channel, control=num, value=val)))
    return tr


def curve_events(tr, on, t, values, tol, message):
    for i in simplify(t, values, tol):
        tr['events'].append((max(on - 0.001, t[i]) if i > 0 else on - 0.001, 0 if i == 0 else 1, message(values[i])))


cs = sorted([n for n in notes if n['part'] == 'cs80' and n.get('track')], key=lambda n: n['onset'])
peak = max(n['peak_db'] for n in cs)
for n in cs:
    # a note lasts as long as the record hears it (until 35 dB under its peak: its loudness
    # curve carries the decay), or until the same key is played again
    again = [m['onset'] for m in cs if m['midi'] == n['midi'] and m['onset'] > n['onset'] + 0.05]
    on = n['onset']; off = max(on + 0.1, min([n['offset']] + [x - 0.02 for x in again]))
    tr = slot(list(range(CS80_CHANNELS)), on); tr['free_at'] = off + a.release
    ch = tr['channel']
    t = n['track']['t0'] + np.arange(len(n['track']['cents'])) * 0.005
    keep = t <= off
    cents = smooth(np.array(n['track']['cents'])[keep], 5)   # 25 ms: the tracker's jitter
    db = smooth(np.array(n['track']['db'])[keep], 21)        # 100 ms: beating with the room
    t = t[keep]
    curve_events(tr, on, t, cents, PITCH_TOL, lambda v: mido.Message('pitchwheel', channel=ch, pitch=bend(v)))
    curve_events(tr, on, t, db - db.max(), LEVEL_TOL, lambda v: mido.Message('control_change', channel=ch, control=11, value=cc11(v)))
    fix = loudness.get(f"{n['start']:.3f}", 0.0)
    vel = int(np.clip(round(127 * 10 ** ((n['peak_db'] - peak) / 40 - fix / 20)), 1, 127))
    tr['events'].append((on, 2, mido.Message('note_on', channel=ch, note=n['midi'], velocity=vel)))
    tr['events'].append((off, 0, mido.Message('note_off', channel=ch, note=n['midi'], velocity=0)))

pads = sorted([n for n in notes if n['part'] == 'pad'], key=lambda n: n['start'])
for n in pads:
    tr = slot([PAD_CHANNEL], n['start']); tr['free_at'] = n['end'] + a.release
    c = n['curve']; db = np.array(c['db']); t = c['t0'] + np.arange(len(db)) / c['rate']
    tr['events'].append((n['start'] - 0.001, 0, mido.Message('pitchwheel', channel=PAD_CHANNEL, pitch=bend(a.tuning))))
    curve_events(tr, n['start'], t, smooth(db, 3), LEVEL_TOL, lambda v: mido.Message('control_change', channel=PAD_CHANNEL, control=11, value=cc11(v)))
    vel = int(np.clip(round(127 * 10 ** (n['level'] / 20)), 1, 127))
    tr['events'].append((n['start'], 2, mido.Message('note_on', channel=PAD_CHANNEL, note=n['midi'], velocity=vel)))
    tr['events'].append((n['end'], 0, mido.Message('note_off', channel=PAD_CHANNEL, note=n['midi'], velocity=0)))

# The low bed under everything (from 0:12 to the end): steady tones between 30 and 52 Hz,
# each held as one note at its exact frequency (a steady bend from the nearest key) whose
# loudness moves between the levels measured over six spans of the record.
if a.rumble:
    rum = json.load(open(a.rumble))
    centres = [(s0 + s1) / 2 for s0, s1 in rum['spans']]
    start, end = 12.0, rum['spans'][-1][1]
    top = max(max(v) for v in rum['levels'].values())
    for hz in rum['lines']:
        levels = np.array(rum['levels'][str(hz)])
        key = 69 + 12 * np.log2(hz / 440); note = int(round(key)); cents = (key - note) * 100
        tr = dict(channel=RUMBLE_CHANNEL, events=[], free_at=end); tracks.append(tr)
        for num, val in ((101, 0), (100, 0), (6, BEND_RANGE), (38, 0)):
            tr['events'].append((0.0, 0, mido.Message('control_change', channel=RUMBLE_CHANNEL, control=num, value=val)))
        tr['events'].append((start - 0.001, 0, mido.Message('pitchwheel', channel=RUMBLE_CHANNEL, pitch=bend(cents))))
        t = np.array([start] + centres + [end]); db = np.concatenate([[levels[0] - 30], levels, [levels[-1]]]) - levels.max()
        # the bed fades in over the record's first seconds
        t[1] = max(t[1], start + 6)
        for ti, v in zip(t, db):
            tr['events'].append((ti if ti > start else start - 0.001, 1, mido.Message('control_change', channel=RUMBLE_CHANNEL, control=11, value=cc11(v))))
        vel = int(np.clip(round(127 * 10 ** ((levels.max() - top) / 20)), 1, 127))
        tr['events'].append((start, 2, mido.Message('note_on', channel=RUMBLE_CHANNEL, note=note, velocity=vel)))
        tr['events'].append((end, 0, mido.Message('note_off', channel=RUMBLE_CHANNEL, note=note, velocity=0)))

mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack(); mid.tracks.append(meta)
meta.append(mido.MetaMessage('track_name', name='Blade Runner Blues (Vangelis, 1982): transcription', time=0))
meta.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
for i, tr in enumerate(tracks):
    mt = mido.MidiTrack(); mid.tracks.append(mt)
    name = 'cs80' if tr['channel'] < CS80_CHANNELS else 'pad' if tr['channel'] == PAD_CHANNEL else 'rumble'
    mt.append(mido.MetaMessage('track_name', name=f'{name} voice {i + 1}', time=0))
    now = 0
    for sec, _, msg in sorted(tr['events'], key=lambda e: (round(e[0] * SEC), e[1])):
        tick = max(0, int(round(sec * SEC)))
        mt.append(msg.copy(time=tick - now)); now = tick
mid.save(a.out)
print(a.out, os.path.getsize(a.out), 'bytes;', len(tracks), 'voice tracks;', len(cs), 'cs80 notes,', len(pads), 'pad notes')
