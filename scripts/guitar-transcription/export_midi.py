"""Write a transcription as a guitar-performance MIDI file.

Conventions (read by src/data/pernambuco.js):
- one track per string, channel = string - 1 (string 1 = high E), GM program 24 (nylon guitar);
  a note's fret is its pitch minus the open string;
- velocity = loudness: the note's attack level in the recording, 25 dB per decade of velocity
  (the arranger plays velocity ** 1.25 as gain);
- CC 70 (sound variation) before a note = the stroke: which recorded take plays
  (0-42 pp, 43-85 mf, 86-127 ff);
- CC 74 (brightness) before a note = a high shelf at 3x the note's frequency, 64 = the take as
  recorded, 1 step = 0.25 dB;
- CC 75 (decay time) before a note = how a muted stroke dies away: 127 rings, below that an
  exponential decay from 20 ms after the pluck with time constant 10 ms * 2 ** (value / 16);
- RPN 1 (channel fine tuning) on every channel = the recording's pitch offset from A440,
  its messages one tick apart so readers that group controllers by number keep their order;
- a tempo change on every beat, so bars and beats line up with the performance while every
  note keeps its measured time.
"""
import mido
import numpy as np

PPQ = 960
TAKE_CC = {'pp': 21, 'mf': 64, 'ff': 106}


def tempo_map(beats):
    """(seconds -> tick, [(tick, seconds per beat)]) for beat times on the output timeline.
    Whole 2/4 bars of lead-in end on the first beat, so time 0 is tick 0 and the first beat
    falls on a bar line; past the last beat its tempo holds."""
    ibi = np.diff(beats)
    lead_beats = int(np.ceil(beats[0] / ibi[0] / 2)) * 2
    lead_ibi = beats[0] / lead_beats if lead_beats else ibi[0]
    lead = lead_beats * PPQ

    def to_tick(t):
        if t <= beats[0]:
            return t / lead_ibi * PPQ
        if t >= beats[-1]:
            return lead + (len(ibi) + (t - beats[-1]) / ibi[-1]) * PPQ
        k = np.searchsorted(beats, t) - 1
        return lead + (k + (t - beats[k]) / ibi[k]) * PPQ

    tempos = [(0, lead_ibi)] + [(lead + k * PPQ, ibi[k]) for k in range(len(ibi))] + [(lead + len(ibi) * PPQ, ibi[-1])]
    return to_tick, tempos


def mute_cc(seconds):
    return 127 if not seconds else int(np.clip(round(16 * np.log2(seconds / 0.01)), 0, 126))


def export(notes, beats, out, cents, name, text):
    """notes: dicts with time, end (s), midi, string, velocity (1-127), take, tilt (shelf dB),
    mute_s (seconds or None), on the output timeline; beats: beat times (s) on it."""
    to_tick, tempos = tempo_map(np.asarray(beats, dtype=float))
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    mid.tracks.append(meta)
    meta.append(mido.MetaMessage('track_name', name=name, time=0))
    meta.append(mido.MetaMessage('text', text=text, time=0))
    meta.append(mido.MetaMessage('time_signature', numerator=2, denominator=4, time=0))
    last = 0
    for tick, seconds in tempos:
        meta.append(mido.MetaMessage('set_tempo', tempo=int(round(seconds * 1e6)), time=tick - last))
        last = tick
    fine = int(round(8192 + cents / 100 * 8192))
    for string in range(1, 7):
        channel = string - 1
        track = mido.MidiTrack()
        mid.tracks.append(track)
        track.append(mido.MetaMessage('track_name', name=f'String {string}', time=0))
        # (tick, order at that tick, message)
        events = [(0, 0, mido.Message('program_change', channel=channel, program=24))]
        rpn = [(101, 0), (100, 1), (6, fine >> 7), (38, fine & 127), (101, 127), (100, 127)]
        events += [(i, 1, mido.Message('control_change', channel=channel, control=cc, value=v)) for i, (cc, v) in enumerate(rpn)]
        current = {}
        for n in sorted((n for n in notes if n['string'] == string), key=lambda n: n['time']):
            on = int(round(to_tick(n['time'])))
            off = max(on + 1, int(round(to_tick(n['end']))))
            stroke = {70: TAKE_CC[n['take']], 74: int(np.clip(round(64 + n['tilt'] * 4), 0, 127)), 75: mute_cc(n.get('mute_s'))}
            for cc, value in stroke.items():
                if current.get(cc) != value:
                    events.append((on, 2, mido.Message('control_change', channel=channel, control=cc, value=value)))
                    current[cc] = value
            events.append((on, 3, mido.Message('note_on', channel=channel, note=n['midi'], velocity=int(n['velocity']))))
            events.append((off, 1, mido.Message('note_off', channel=channel, note=n['midi'], velocity=0)))
        last = 0
        for tick, _, msg in sorted(events, key=lambda e: (e[0], e[1])):
            msg.time = tick - last
            last = tick
            track.append(msg)
    mid.save(out)
    return mid
