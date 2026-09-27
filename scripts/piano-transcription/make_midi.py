"""A piano score (run_bytedance.py's notes and pedal, on the record's timeline) -> the piece's
MIDI file.

Conventions (read by src/data/memoriesOfGreen.js):
- the piano on channel 1 (index 0), GM program 0; key-down and key-up as the notes;
- velocity = loudness: the note plays at gain (velocity / 127) ** 2 (40 dB over the range);
  the model's velocity maps to it through a fixed curve, then `--loudness` adds closed-loop
  corrections in dB per note (calibrate.py; rounds comma-separated, at most 6 dB a round);
- CC 64 (sustain) as the model heard the pedal;
- RPN 1 (fine tuning) = the record's pitch offset from A440 (the samples are built there);
- a fixed 120 BPM: the piece is played in free time and every note keeps its measured time;
- `--glides` (cluster_notes.py) adds the glide cluster on channel 2: a note on every semitone
  line for each span where it sounds, all bent together by the channel's pitch bend (RPN 0 =
  24 semitones; the bend is the cluster's pitch in cents from A440's grid) and shaped by its
  CC 11 ((value - 127) / 2 dB), every 50 ms; velocity is each line's level.

usage: make_midi.py score.json out.mid --cents -32.1 [--loudness r0.json,r1.json] [--drop drop.json]
       [--add add.json] [--layers "0:6,70:10"] [--glides glides.json]
- CC 70 (sound variation) before each note = the Salamander velocity layer it plays (1-16),
  chosen from the model's velocity by `--layers` (thresholds: layer), since the layer is the
  note's timbre and the loudness loop must not change it.
"""
import json, sys
import mido
import numpy as np
from piano_score import load

PPQ = 960
SECONDS_PER_TICK = 0.5 / PPQ


def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def key(n):
    return f"{n['on']:.3f}:{n['pitch']}"


def model_gain_db(vel):
    """ByteDance velocity (MAESTRO's Disklavier scale) -> dB, a first guess the loop corrects:
    about 0.5 dB per step around the middle of the range."""
    return (vel - 64) * 0.5


def glide_track(g):
    """The glide cluster on channel 2 (index 1): notes per sounding span, a shared bend and CC 11."""
    step = 1 / g['rate']; t0 = g['start']
    cents = np.array(g['cents']); level = np.array(g['level_db'])
    times = t0 + np.arange(len(cents)) * step
    on = level > -100
    edges = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0]))
    spans = list(zip(edges[::2], edges[1::2]))
    events = []
    for i in range(0, len(cents), max(1, int(round(0.05 / step)))):
        bend = int(np.clip(round(cents[i] / 2400 * 8192), -8192, 8191))
        events.append((times[i], 1, mido.Message('pitchwheel', channel=1, pitch=bend)))
        events.append((times[i], 1, mido.Message('control_change', channel=1, control=11, value=int(np.clip(round(127 + 2 * max(level[i], -63.5)), 0, 127)))))
    for a, b in spans:
        for n in g['notes']:
            vel = int(np.clip(round(127 * 10 ** (n['db'] / 40)), 1, 127))
            events.append((times[a], 2, mido.Message('note_on', channel=1, note=n['midi'], velocity=vel)))
            events.append((times[b - 1], 0, mido.Message('note_off', channel=1, note=n['midi'], velocity=0)))
    events.sort(key=lambda e: (e[0], e[1]))
    track = mido.MidiTrack()
    track.append(mido.MetaMessage('track_name', name='Glides', time=0))
    for i, (num, val) in enumerate([(101, 0), (100, 0), (6, 24), (38, 0), (101, 127), (100, 127)]):
        track.append(mido.Message('control_change', channel=1, control=num, value=val, time=1 if i else 0))
    tick = 5
    for t, _, msg in events:
        at = max(tick, int(round(t / SECONDS_PER_TICK)))
        track.append(msg.copy(time=at - tick)); tick = at
    return track


def main():
    src, out = sys.argv[1], sys.argv[2]
    cents = float(option('--cents'))
    notes, pedal = load(src)
    drop = set(json.load(open(option('--drop')))) if option('--drop') else set()
    notes = [n for n in notes if key(n) not in drop]
    if option('--add'):
        notes += json.load(open(option('--add')))
    corr = {}
    for path in filter(None, (option('--loudness') or '').split(',')):
        for k, v in json.load(open(path))['notes'].items():
            corr[k] = corr.get(k, 0) + float(np.clip(v, -6, 6))
    layers = sorted((int(a), int(b)) for a, b in (kv.split(':') for kv in option('--layers', '0:8').split(',')))
    layer_of = lambda v: [l for t, l in layers if v >= t][-1]
    events = []
    for n in notes:
        events.append((n['on'], 0.5, mido.Message('control_change', channel=0, control=70, value=layer_of(n['vel']))))
        db = model_gain_db(n['vel']) + corr.get(key(n), 0) - 6
        vel = int(np.clip(round(127 * 10 ** (db / 40)), 1, 127))
        events.append((n['on'], 1, mido.Message('note_on', channel=0, note=n['pitch'], velocity=vel)))
        events.append((max(n['off'], n['on'] + 0.02), 0, mido.Message('note_off', channel=0, note=n['pitch'], velocity=0)))
    for p in pedal:
        events.append((p['on'], 2, mido.Message('control_change', channel=0, control=64, value=127)))
        events.append((p['off'], -1, mido.Message('control_change', channel=0, control=64, value=0)))
    events.sort(key=lambda e: (e[0], e[1]))
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack(); mid.tracks.append(meta)
    meta.append(mido.MetaMessage('track_name', name='Memories of Green (Vangelis, 1980)', time=0))
    meta.append(mido.MetaMessage('text', text=option('--source', 'Transcribed from Vangelis, Blade Runner (EastWest 1994), track 8'), time=0))
    meta.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
    if option('--glides'):
        mid.tracks.append(glide_track(json.load(open(option('--glides')))))
    track = mido.MidiTrack(); mid.tracks.append(track)
    track.append(mido.MetaMessage('track_name', name='Piano', time=0))
    track.append(mido.Message('program_change', channel=0, program=0, time=0))
    fine = int(round(8192 + cents / 100 * 8192))
    for i, (num, val) in enumerate([(101, 0), (100, 1), (6, fine >> 7), (38, fine & 127), (101, 127), (100, 127)]):
        track.append(mido.Message('control_change', channel=0, control=num, value=val, time=1 if i else 0))
    tick = 6
    for t, _, msg in events:
        at = max(tick, int(round(t / SECONDS_PER_TICK)))
        track.append(msg.copy(time=at - tick)); tick = at
    mid.save(out)
    print(out, len(notes), 'notes', len(pedal), 'pedal spans')


if __name__ == '__main__':
    main()
