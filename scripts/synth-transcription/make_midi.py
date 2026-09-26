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
       [--bed bed.json] [--bass bass.json] [--pad-fix pad_fix.json]
"""
import argparse, json, os
import numpy as np
import mido
from scipy.ndimage import median_filter, uniform_filter1d

ap = argparse.ArgumentParser(); ap.add_argument('notes'); ap.add_argument('out')
ap.add_argument('--tuning', type=float, default=11.6); ap.add_argument('--release', type=float, default=1.2)
ap.add_argument('--loudness', help='closed-loop corrections: dB per CS-80 note, keyed by start')
ap.add_argument('--bed', help='the low bed: bed.json (bed_lines.py), lines with their own level nodes')
ap.add_argument('--bass', help='the bass line: bass.json (bass_notes.py), notes {time, duration, midi, cents, velocity, gain}')
ap.add_argument('--pad-fix', help='closed-loop cuts to low pad notes: dB keyed "start:midi" (pad_fix.py)')
a = ap.parse_args()
TPB = 960; SEC = TPB * 2
BEND_RANGE = 12
PITCH_TOL = 2.0   # cents
LEVEL_TOL = 1.5   # dB
CS80_CHANNELS = 8
PAD_CHANNEL = 12
RUMBLE_CHANNEL = 14
BASS_CHANNEL = 15


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
pad_fix = json.load(open(a.pad_fix)) if a.pad_fix else {}
for n in pads:
    tr = slot([PAD_CHANNEL], n['start']); tr['free_at'] = n['end'] + a.release
    c = n['curve']; db = np.array(c['db']); t = c['t0'] + np.arange(len(db)) / c['rate']
    tr['events'].append((n['start'] - 0.001, 0, mido.Message('pitchwheel', channel=PAD_CHANNEL, pitch=bend(a.tuning))))
    curve_events(tr, n['start'], t, smooth(db, 3), LEVEL_TOL, lambda v: mido.Message('control_change', channel=PAD_CHANNEL, control=11, value=cc11(v)))
    vel = int(np.clip(round(127 * 10 ** ((n['level'] + pad_fix.get(f"{n['start']:.2f}:{n['midi']}", 0.0)) / 20)), 1, 127))
    tr['events'].append((n['start'], 2, mido.Message('note_on', channel=PAD_CHANNEL, note=n['midi'], velocity=vel)))
    tr['events'].append((n['end'], 0, mido.Message('note_off', channel=PAD_CHANNEL, note=n['midi'], velocity=0)))

# The low bed under everything (from 0:12 to the end): the lines of a sound that repeats every
# 1.692 s, 30-57 Hz, each held as one note at its exact frequency (a steady bend from the
# nearest key) whose loudness follows the record every few seconds.
def bed_track(hz, times, dbs):
    key = 69 + 12 * np.log2(hz / 440); note = int(round(key)); cents = (key - note) * 100
    tr = dict(channel=RUMBLE_CHANNEL, events=[], free_at=times[-1]); tracks.append(tr)
    for num, val in ((101, 0), (100, 0), (6, BEND_RANGE), (38, 0)):
        tr['events'].append((0.0, 0, mido.Message('control_change', channel=RUMBLE_CHANNEL, control=num, value=val)))
    start = times[0]
    tr['events'].append((start - 0.001, 0, mido.Message('pitchwheel', channel=RUMBLE_CHANNEL, pitch=bend(cents))))
    curve_events(tr, start, np.asarray(times, float), np.asarray(dbs, float), LEVEL_TOL,
                 lambda v: mido.Message('control_change', channel=RUMBLE_CHANNEL, control=11, value=cc11(v)))
    tr['events'].append((start, 2, mido.Message('note_on', channel=RUMBLE_CHANNEL, note=note, velocity=127)))
    tr['events'].append((times[-1], 0, mido.Message('note_off', channel=RUMBLE_CHANNEL, note=note, velocity=0)))


bed = json.load(open(a.bed))['lines'] if a.bed else []
for line in bed:
    bed_track(line['hz'], line['t'], line['db'])

# The bass line: centred low notes that start abruptly (the record's "booms"), each on a voice
# track of channel 16 with its tuning as a steady bend and its gain curve as CC 11 nodes.
bass = json.load(open(a.bass)) if a.bass else dict(rate=100, notes=[])
for n in sorted(bass['notes'], key=lambda n: n['time']):
    on, off = n['time'], n['time'] + n['duration']
    tr = slot([BASS_CHANNEL], on); tr['free_at'] = off + a.release
    tr['events'].append((on - 0.001, 0, mido.Message('pitchwheel', channel=BASS_CHANNEL, pitch=bend(n.get('cents', a.tuning)))))
    g = np.maximum(np.asarray(n['gain'], float), 1e-4); t = on + np.arange(len(g)) / bass['rate']
    curve_events(tr, on, t, 20 * np.log10(g), LEVEL_TOL, lambda v: mido.Message('control_change', channel=BASS_CHANNEL, control=11, value=cc11(v)))
    vel = int(np.clip(round(127 * n['velocity']), 1, 127))
    tr['events'].append((on, 2, mido.Message('note_on', channel=BASS_CHANNEL, note=n['midi'], velocity=vel)))
    tr['events'].append((off, 0, mido.Message('note_off', channel=BASS_CHANNEL, note=n['midi'], velocity=0)))

mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack(); mid.tracks.append(meta)
meta.append(mido.MetaMessage('track_name', name='Blade Runner Blues (Vangelis, 1982): transcription', time=0))
meta.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
for i, tr in enumerate(tracks):
    mt = mido.MidiTrack(); mid.tracks.append(mt)
    name = ('cs80' if tr['channel'] < CS80_CHANNELS else 'pad' if tr['channel'] == PAD_CHANNEL
            else 'bass' if tr['channel'] == BASS_CHANNEL else 'rumble')
    mt.append(mido.MetaMessage('track_name', name=f'{name} voice {i + 1}', time=0))
    now = 0
    for sec, _, msg in sorted(tr['events'], key=lambda e: (round(e[0] * SEC), e[1])):
        tick = max(0, int(round(sec * SEC)))
        mt.append(msg.copy(time=tick - now)); now = tick
mid.save(a.out)
print(a.out, os.path.getsize(a.out), 'bytes;', len(tracks), 'voice tracks;', len(cs), 'cs80 notes,', len(pads), 'pad notes,',
      len(bed), 'bed lines,', len(bass['notes']), 'bass notes')
