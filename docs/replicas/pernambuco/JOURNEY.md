# Pernambuco: the journey

*Rebuilt by Claude Opus 5.5 with Luke, 24-25 September 2026.*

Luke asked for Luiz Bonfá's "Pernambuco" to open the page, built from MIDI, with the sound,
the velocity, the timbre and the touch as close to the record as they could be made. This is how
it was rebuilt, written up afterwards from the work's own record (its commits and the toolkit's
notes); the commands are in `scripts/guitar-transcription/README.md`.

## The record

**Source.** *Solo in Rio 1959* (Smithsonian Folkways SFW40483): one nylon-strung Do Souto
guitar, recorded live in Rio on a mono Nagra III tape recorder. The liner notes describe the
accompaniment as muted and percussive, struck with the thumb. The upload analysed is mono (left
and right correlate at 0.9996).

**Pitch.** The record runs 41.7 cents above A440 and holds it within about 2 cents from start
to finish: the tape's speed, not the guitar's tuning (older transfers of this material are
documented running 31 to 77 cents sharp). Every analysis runs on a copy moved to A440, and the
MIDI file carries the record's own pitch back.

## Hearing the notes

Three published guitar-transcription models from Queen Mary University of London proposed the
notes: two trained on classical guitar, one on fingerstyle recordings that include three Bonfá
tracks from this same album. The two strongest agree at onset F1 0.91; basic-pitch, a general
model, agreed with them only at 0.67-0.73.

Then analysis by synthesis: a model explains the record's spectrogram as the sum of its notes,
each one the University of Iowa recording of its exact string, fret and stroke (soft, medium or
hard), and fits everything the player controls: when each note starts and stops (ringing,
damped, or muted by the thumb), how loud and how bright each stroke is, which string it is on,
which notes are missing and which are spurious. It also fits how Bonfá's guitar and tape differ
from the Iowa guitar: an equaliser, a faster decay of the upper partials, a per-pitch balance of
partials and the room.

- The liner notes' thumb became a per-note mute, a decay that starts just after the pluck. It
  cut the model's error by 17% in one step.
- The traps, found the hard way: the file ends in digital silence (the noise floor came out as
  zero and notes began explaining tape hiss); the treble needs square-root whitening, or the
  hiss dominates the fit; a note's envelope must act in time and be smeared the way the
  analysis sees each frequency, or the fit invents a room; and a stroke's brightness is a high
  shelf at three times the note's frequency, exactly as the page plays it, so the analysis and
  the playback agree.

## The recordings

127 takes, cut from the Iowa guitar's 24-bit/96 kHz mono masters, whose noise floor sits about
112 dB under full scale, so even the softest strokes are usable. Each is retuned, then voiced
like the record by the fitted curves. One take split wrongly: a click before an edited gap stole
its pluck, so a pluck now has to be followed by sound 100-200 ms on. The app learned three
things for this piece: a stroke's brightness, how fast a muted stroke dies away, and a set of
recordings' own level.

## The recording chain

The record's floor is flat tape hiss above 3 kHz, with no mains hum, so the page lays eight
seconds of looping white noise under the piece, 44 dB under the music as on the record
(rendered 43.9 dB, record 44.2). The room was chosen by rendering the opening under 47 reverb
settings and keeping the one closest to the record: mono, as the record is.

## Where it stands

1,239 notes on six string tracks, played from 127 recordings. Rendered offline the way the page
plays it and compared with the record:

| | against the record |
|---|---|
| every note's loudness | IQR -0.2..+0.3 dB, 5-95% -1.0..+1.3 dB |
| loudness contour, 100 ms | r 0.948 |
| long-term spectrum | within about 2 dB from 62 Hz to 16 kHz |
| log-CQT / chroma similarity | 0.940 / 0.958 |
| tape hiss under the music | 43.9 dB (record 44.2) |
| plucks | +2.9 ms median |

Luke's first question on hearing it was whether it was the real recording. It is not: renders
of the melody alone, of the thumb alone and at half speed showed him what it is made of.

**Not modelled:** the tape's flutter (about 2.4 cents at 19 Hz) and finger noise on the wound
strings.
