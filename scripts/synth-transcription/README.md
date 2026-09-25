# Synth transcription

How "Blade Runner Blues" (`public/midi/performances/blade-runner-blues.mid`) was taken from
Vangelis's record (*Blade Runner*, EastWest 1994; track 7, recorded 1982 on a Yamaha CS-80)
into a MIDI file that the app's own synthesizer plays (`src/data/bladeRunnerBlues.js`). The
record is never committed: it is fetched into a scratch folder and analysed there, and only
notes, curves and measurements leave it. The journey, with what each step changed, is in
`docs/replicas/blade-runner-blues/JOURNEY.md`.

The record has four layers, and each is taken out its own way:

- **The CS-80** (the melody and the notes held under it): basic-pitch's note posterior finds
  the notes; each note's pitch, loudness and harmonic make-up are then read from the record
  every 5 ms, pitch from the harmonics up to 16 kHz, where a cent is widest. The curves carry
  the CS-80's scoop into every note, its slow vibrato and its swells.
- **The pad**: the record's constant-Q spectrum, the CS-80's harmonics masked out, is fitted
  as notes that share one learned harmonic template (shift-invariant NMF); each pitch's
  activation becomes a note with its own swell.
- **The low bed**: steady tones between 30 and 52 Hz under the whole piece, measured one by
  one over six spans.
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
   (played notes). `lead_notes.py layers.json lead.json`: the fast layer from A3 up, less
   the flicker of held pad keys.
4. `lead_expression.py brb48.wav lead.json lead_expr.json`: each CS-80 note's pitch and
   loudness curves (5 ms) and its harmonics.
5. `pad_nmf.py brb48.wav lead_expr.json pad.npz --iters 150 --sparsity 1.0`, then
   `pad_notes.py pad.npz lead_expr.json score.json`: the pad's notes and swells, added to
   the CS-80's.
6. `rumble_lines.py brb48.wav rumble.json`: the low bed's tones and their levels.
7. `make_midi.py score.json out.mid --rumble rumble.json [--loudness loudness.json]`.
8. Closed loop: render the file the way the page plays it,
   `BRB_MIDI=out.mid node scripts/render_performance.mjs --score $T/score.mjs --out render.wav`,
   read the same notes out of the render (`lead_expression.py render.wav lead_expr.json
   render_expr.json`), and `loudness_round.py lead_expr.json render_expr.json round.json
   [--prev earlier.json]` turns each note's difference into a velocity correction for step 7.
   Four rounds made `loudness.json` (committed here: 191 numbers, dB per note by its start).

`fit_gains.py` (part levels from stems), `bands.py` (third-octave spectra), `floor.py` (the
steady floor), `cqt_distance.py` (how far a render's picture is from the record's), `ab.py`
(record over render), `review.py` and `zoom.py` (pitch-grid pictures with notes) are how the
patches, the levels, the room and the noise bed were set and checked.

## Where it stands (v1)

Against the record, rendered offline: each CS-80 note's pitch curve within 1.1 cents
(median; IQR 0.8-1.5), its peak loudness within 1.6 dB for 80% of notes, the whole piece's
level within 0.3 dB (RMS -30.0 against -30.3 dBFS), its stereo width alike (left/right
correlation 0.36 against 0.38), the floor within 4 dB in every octave, and the constant-Q
picture 5.9-7.9 dB from the record's (mean absolute difference, 60 dB range).

Not yet: the low booms (about 30 short low hits), the pad's upper voices (the fit keeps few
of them), the CS-80's exact filter and brilliance, and a room fitted beyond the first sweep.
