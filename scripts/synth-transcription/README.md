# Synth transcription

How "Blade Runner Blues" (`public/midi/performances/blade-runner-blues.mid`) was taken from
Vangelis's record (*Blade Runner*, EastWest 1994; track 7, recorded 1982 on a Yamaha CS-80)
into a MIDI file that the app's own synthesizer plays (`src/data/bladeRunnerBlues.js`). The
record is never committed: it is fetched into a scratch folder and analysed there, and only
notes, curves and measurements leave it. The journey, with what each step changed, is in
`docs/replicas/blade-runner-blues/JOURNEY.md`.

The record has five layers, and each is taken out its own way:

- **The CS-80** (the melody and the notes held under it): basic-pitch's note posterior finds
  the notes; each note's pitch, loudness and harmonic make-up are then read from the record
  every 5 ms, pitch from the harmonics up to 16 kHz, where a cent is widest. The curves carry
  the CS-80's scoop into every note, its slow vibrato and its swells.
- **The pad**: the record's constant-Q spectrum, the CS-80's harmonics masked out, is fitted
  as notes that share one learned harmonic template (shift-invariant NMF); each pitch's
  activation becomes a note with its own swell.
- **The bass**: low notes that start abruptly and sit in the middle of the stereo picture (the
  record's "booms"), found as narrowband rises and harmonic combs, each with its decay.
- **The low bed**: a sound that repeats every 1.692 s under the whole piece, so its lines sit
  on a 0.591 Hz grid (30-57 Hz), each with its level every 4 s.
- **The floor**: a steady noise under the music, matched by synthesized noise (in the page
  module) to each octave's quietest moments.

## Setup

The same environments as `scripts/guitar-transcription` (see its README): `analysis` for
everything here, `bp` for basic-pitch.

## Steps, as run

`T=scripts/synth-transcription`, in a scratch folder.

1. The record: `yt-dlp -f "251/140/bestaudio" "https://www.youtube.com/watch?v=ECYLHiXvrBQ"`
   (the label's upload), decoded to `brb48.wav` (48 kHz stereo) and a mono 44.1 kHz copy for
   basic-pitch. It runs 11.6 cents above A440 (`scripts/guitar-transcription/tuning.py`).
2. `run_basic_pitch.py brb_mono44.wav bp` (bp environment): note and onset posteriors.
3. `layers.py bp.npz layers.json`: a slow layer (keys held for seconds) and a fast layer
   (played notes), on the record's timeline (basic-pitch's frames are 256 samples apart only
   within its windows; layers.py maps them). `lead_notes.py layers.json lead.json --keep
   $T/lead_keep.json`: the fast layer from A3 up, less the flicker of held pad keys, plus the
   long legato notes that test throws out and that rendered back in bring the record's picture
   closer (the list).
4. `lead_expression.py brb48.wav lead.json lead_expr.json`: each CS-80 note's pitch and
   loudness curves (5 ms) and its harmonics.
5. `pad_nmf.py brb48.wav lead_expr.json pad.npz --iters 150 --sparsity 1.0`, then
   `pad_notes.py pad.npz lead_expr.json score.json`: the pad's notes and swells, added to
   the CS-80's.
6. `bed_lines.py brb48.wav bed.json --fix $T/bed_fix.json`: the low bed's lines and levels.
7. `bass_notes.py brb48.wav bass.json`: the bass line.
8. `make_midi.py score.json out.mid --bed bed.json --bass bass.json --loudness
   $T/loudness.json --pad-fix $T/pad_fix.json`.

Closed loops, each a render the way the page plays it (`BRB_MIDI=out.mid node
scripts/render_performance.mjs --score $T/score.mjs --out render.wav`; `BRB_PARTS=pad` and the
like render single parts, `BRB_NOISE=off` leaves the floor out) read back with the tools that
read the record:

- `loudness_round.py lead_expr.json render_expr.json round.json [--prev earlier.json]`, where
  `render_expr.json` is `lead_expression.py render.wav lead_expr.json`: each CS-80 note's
  peak against the record's, as a velocity correction for step 8 (`loudness.json`, dB per note
  by its start). Run it last: every other change moves the peaks.
- `pad_fix.py brb48.wav pad.wav others.wav score.json pad_fix.json --gain -1`: cuts to the
  pad's low notes (up to D3) wherever the pad alone is louder at a note's fundamental than
  what the record leaves there once the other parts are taken out. `pad.wav` is the pad alone
  from a file made without `--pad-fix`; `others.wav` is every other part with the floor. The
  committed cuts were fitted with the pad 1 dB under where it plays (`--gain -1`); the pad's
  level was then set where it carries the sound.
- `bed_round.py brb48.wav bed.wav bed.json offsets.json` (`bed.wav`: `BRB_PARTS=rumble
  BRB_NOISE=off`): each bed line's level in the render against the record's, as the offsets
  step 6 takes out (`bed_fix.json`, one round).

`fit_gains.py` (part levels from stems), `bands.py` (third-octave spectra), `floor.py` (the
steady floor), `cqt_distance.py` (how far a render's picture is from the record's), `ab.py`
(record over render), `review.py` and `zoom.py` (pitch-grid pictures with notes) are how the
patches, the levels, the room and the noise bed were set and checked.

## Where it stands (v2)

Against the record, rendered offline, over 0:15-8:45 unless said: the whole piece's level
within 0.02 dB (-28.66 against -28.64 dBFS, both channels' mean square) and its stereo width
alike (left/right correlation 0.388 against 0.380); each CS-80 note's peak loudness within 1.6
dB for 93% of its 342 notes and its pitch curve within 0.8 cents (median); the constant-Q
picture 5.66 dB from the record's over 0:10-8:40 (mean absolute difference, 60 dB range; v1
6.45); the long-term spectrum within 1.21 dB per third octave (v1 3.11); the floor within 2 dB
in every octave. The journey has the rest, and what is still open.
