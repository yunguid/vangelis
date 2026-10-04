"""Clean the transcription's false notes out of the piece's MIDI file.

Two kinds, both rung out to full piano notes by the pedal:
- clicks: onsets the model heard with no tone after them, which make_midi.py writes at its
  20 ms floor. No key on the record is held that briefly; they are the chirps (trains of
  G#6/D#6/D#7 at 1:44, F7 at 3:09) and stray blips (every G#4 in the piece, all over F major).
  All are dropped.
- stutters: one ringing note heard as a burst of re-attacks on the same key (F#6 from 0:07 to
  0:12 struck 25 times; C5 34 times from 4:28). The piece is slow and rubato: no key is played
  again within REPEAT seconds, so a run of same-pitch onsets closer than that becomes its first
  note (its onset, velocity and CC 70 layer), held to the run's last key-up.

The glide channel, pedal and tuning are left as they are.

usage: clean_notes.py in.mid out.mid [--dry-run]
"""
import sys
from collections import defaultdict
import mido

REPEAT = 0.4
CLICK = 0.03


def main():
    src, out = sys.argv[1], sys.argv[2]
    mid = mido.MidiFile(src)
    spt = 0.5 / mid.ticks_per_beat  # fixed 120 BPM (make_midi.py)
    track = next(t for t in mid.tracks if any(m.type == 'track_name' and m.name == 'Piano' for m in t))

    events, tick = [], 0
    for msg in track:
        tick += msg.time
        events.append([tick, msg])

    # Pair each key-down with its key-up and the CC 70 just before it.
    notes, open_ = [], defaultdict(list)  # per key, oldest first: overlapping strikes pair FIFO
    for i, (t, m) in enumerate(events):
        if m.type == 'note_on' and m.velocity > 0:
            cc = i - 1 if i and events[i - 1][1].type == 'control_change' and events[i - 1][1].control == 70 else None
            open_[m.note].append({'pitch': m.note, 'on': t, 'i_on': i, 'i_cc': cc})
        elif m.type in ('note_off', 'note_on') and open_[m.note]:
            n = open_[m.note].pop(0); n['off'] = t; n['i_off'] = i; notes.append(n)

    def remove(n):
        drop.update(i for i in (n['i_on'], n['i_off'], n['i_cc']) if i is not None)

    drop, retime, merged = set(), {}, 0
    by_pitch = defaultdict(list)
    for n in notes:
        if (n['off'] - n['on']) * spt <= CLICK:
            remove(n)
        else:
            by_pitch[n['pitch']].append(n)
    clicks = len(notes) - sum(map(len, by_pitch.values()))
    for ns in by_pitch.values():
        ns.sort(key=lambda n: n['on'])
        runs = [[ns[0]]]
        for n in ns[1:]:
            if (n['on'] - runs[-1][-1]['on']) * spt < REPEAT:
                runs[-1].append(n)
            else:
                runs.append([n])
        for k, run in enumerate(runs):
            if len(run) < 2:
                continue
            for n in run[1:]:
                remove(n)
            merged += len(run) - 1
            end = max(n['off'] for n in run)
            if k + 1 < len(runs):  # key-up before the key's next strike
                end = min(end, runs[k + 1][0]['on'] - 1)
            retime[run[0]['i_off']] = end

    print(f'{len(notes)} notes: {clicks} clicks dropped, {merged} re-attacks merged -> {len(notes) - merged - clicks}')
    if '--dry-run' in sys.argv:
        return
    for i, t in retime.items():
        events[i][0] = t
    kept = sorted(((t, i, m) for i, (t, m) in enumerate(events) if i not in drop), key=lambda e: (e[0], e[1]))
    track.clear()
    tick = 0
    for t, _, m in kept:
        track.append(m.copy(time=t - tick)); tick = t
    mid.save(out)
    print(out)


if __name__ == '__main__':
    main()
