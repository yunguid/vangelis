# Memories of Green: the journey

*Rebuilt by Claude Opus 5.5 with Luke, 27 September 2026.*

Rebuilding Vangelis's "Memories of Green" inside Vangelis (the app). Luke called it probably
the most challenging one: several layers, and the one he cares about most is the piano. As
with the other replicas, nothing from the record reaches the site. The piano is transcribed
from the record and played from openly licensed recordings of a grand piano, voiced to sound
like the record's; the other layers are designed on the app's own synthesizer. Every entry
says what was tested, with which tool, what it measured and what it decided; the commands are
in `scripts/piano-transcription/README.md`.

## 2026-09-27: the record

**Source.** Track 8 of *Blade Runner (Music From The Original Soundtrack)*, EastWest 1994.
Two uploads of the same album track were fetched with yt-dlp (run through `uvx`): the label's
own ("Provided to YouTube by EastWest U.K.", video u1KfOMkyU_w, 305.0 s) and the one Luke
linked (video 6uXnXEdXGJY, 305.3 s). Both are Opus at 48 kHz stereo, 135 kbps. Aligned (the
fan copy runs 226 ms late), they have the same level to 0.04 dB, the same left/right
correlation (0.728) and the same spectrum up to 16 kHz, but the fan copy has 8 dB less between
16 and 20 kHz and 13 dB less above 20 kHz: it was made from an already band-limited file. The
label's upload is the one used from here on.

**What the numbers say.**
- Pitch: `tuning.py` finds the whole track 32.1 cents flat of A440 (Blade Runner Blues, from
  the same album, sits 11.6 cents sharp), and every ten-second window between -28.6 and -35.2:
  a steady offset, no drift. Every analysis runs on a copy moved to A440; the piece carries the
  offset as its playback pitch.
- A quiet, dynamic master: peaks at -4.3 dBFS, an average of -32 dBFS, and 5-second windows
  anywhere from -21 to -62 dB.
- Stereo: left/right correlation 0.73 overall and 0.71-0.77 from 63 Hz to 2 kHz, falling to
  0.47 at 8 kHz. The low end leans left (the left channel 6.3 dB louder at 63 Hz, 4.8 at
  125 Hz, 2.2 at 250 Hz, level from 500 Hz to 2 kHz) and the top leans right (3.3 dB at
  8 kHz): a piano seen from the keyboard, bass to the left.
- The form, from constant-Q pictures and the loudness contour: from 0:02 the piano's top
  register alone (F#6 and C#6 over the other sounds), the full piano from 0:18.6, louder from
  0:31; loud peaks around 1:20-2:05 and 2:45-3:15, a quiet valley at 3:20-3:50, then a long
  quiet close from 4:40. The harmony moves from B minor and D (0:30-2:40) to F major
  (2:50-4:35) and back to D.

## 2026-09-27: taking the record apart

**Demucs does not know this piano.** htdemucs_6s (demucs 4.0.1, eight seeded offsets, 623 s
on the CPU) was run to lift the piano out. Its six stems, level against the mix per 15 s: the
"guitar" stem holds most of the piano (-3 dB of the mix overall), but "piano" (-12 dB) and
"other" (-10 dB) take it over for whole stretches, and the constant-Q pictures show the same
chord moving between the three from one second to the next. Blade Runner Blues met the same
thing with its CS-80. No stem is "the piano", so the piano's reference is the whole record,
where it dominates everything after 0:18; the stems are used to find the other layers.

**The layers.** What the pictures and the smaller stems show:

| Layer | When | What it is | Where |
|---|---|---|---|
| Piano | 0:02 to 4:52 | an acoustic grand, pedalled almost throughout (the pedal model hears it down for 285 of 305 s); B0 to F#7, most notes C4 to B5 | leaning left in the bass (6 dB at 63 Hz), level from 500 Hz, a little right at the top |
| Glides | all through, as first read (later: 0:00-0:57, 3:15-3:36, 4:02 to the end) | rows of lines whose pitch sweeps up and down over 6 to 10 s, read at first as harmonics (later: a chromatic cluster, below); one plain sine glide (0:09 to 0:14) | wide |
| Chirps | the intro, then here and there | short tonal blips at about 1.75, 3 and 5 kHz, a second or so apart | |
| Buzz | 3:24 to 3:32 | a pulsing, rattling band from about 2 to 4 kHz (Demucs files it as "drums") | |
| Whoosh | 4:16 to 4:21 | a broadband sound sweeping down, like something passing (Demucs files it as "vocals") | |
| Floor | all through | hiss 53.2 dB under the music, flat as pink noise from 9 to 14 kHz; a hum line near 50 Hz | both channels |

## 2026-09-27: what kind of piano

The first question was the instrument. Vangelis played a Yamaha CP-80 electric grand around
then (it is on the Chariots of Fire theme, 1981), and an electric grand would need different
samples. Three tests, run the same way on the record's exposed notes and on Salamander Grand
V3 (a Yamaha C5 grand) at velocity layer 8 (`instrument_tests.py`, `below_f0.py`):

- **Inharmonicity.** A stiff string's partials run sharp by a factor sqrt(1 + B n^2), and B
  grows fast as strings get shorter. Partials tracked outwards and fitted: the record's B2, C3
  and C#3 measure B = 1.8e-4, 0.7e-4 and 1.1e-4; the C5 grand's A1 to C3 measure 0.8e-4 to
  1.0e-4, and its B climbs to 2.8e-3 by C6 as a grand's does. The record's mid-range notes (B3
  to F4, 2e-4 to 7e-4) sit within a factor of two of the C5's. The CP-80's bass strings are far
  shorter than a grand's and would read several times higher. So: an acoustic grand.
- **What sounds under a high note.** Around clear onsets from C5 up, the energy under 0.8 f0
  (the hammer's knock through the body) against the fundamental: record -13.9 dB, the C5
  -10.9 dB, 0 to 60 ms after the onset. Close; later in the note the record's other layers
  swamp the measure.
- **Decay by register** could not be read cleanly: with the pedal down nearly throughout,
  other notes ring into every window. Chorus or phasing in the partials was not tested.

Salamander Grand V3 it is (CC-BY 3.0; the credit is in `public/samples/memories-of-green/README.md`).

## 2026-09-27: the notes

**Three transcriptions.** ByteDance's high-resolution piano transcription
(piano-transcription-inference 0.1.0, the checkpoint with note F1 0.9677 and pedal F1 0.9186)
hears notes, velocities and the sustain pedal; it ran on a copy of the record moved to A440,
with the times mapped back. On the full mix it found 1,206 notes and 91 pedal spans; on the
sum of the three stems that hold the piano (Demucs's guitar, piano and other, which leaves out
what went to drums, bass and vocals: the buzz and the whoosh) it found 1,318. The two agree
at onset F1 0.79 (the same pitch within 50 ms; 999 notes in both, median offset 0 ms).
basic-pitch 0.4.0 found 2,172 on the mix and agrees with ByteDance's mix run at only F1 0.40:
it splits held notes and hears the glides as notes, so it was only a cross-check.

**Disputed notes, settled by synthesis** (`arbitrate.py`). Each note only one ByteDance run
found was played from the sample the page would use, at its velocity and for as long as the
pedal holds it, and added to (or taken out of) the current render; it was kept if that brought
the render's spectrogram closer to the record's over the note's first six partials in its first
0.4 s. Of the mix run's 207 lone notes, 201 stayed and 6 went; of the stems run's 319, 185 came
in and 134 did not: 1,385 notes. The loudness contour's correlation with the record rose from
0.708 to 0.736.

**A check by eye.** I can't listen, so the hand check is against a constant-Q picture of
0:18.3-0:25, where the full piano comes in (`overlay.py`): of 15 notes, 12 sit on a line that
starts where they do; 3 are uncertain (two A3s and an A2 re-strike that may be the octave
partials of lower notes); no line starts without a note.

**The pedal.** The page plays the pedal the way a piano does: a note sounds until its key comes
up or, if the pedal is down then, until the pedal comes up; a key struck again cuts its earlier
note; the damper then takes 0.3 s. The recordings are never cut shorter than a note sounds, and
no envelope is laid over their own decay (the lessons of the landing lullaby's piano).

## 2026-09-27: voicing the piano

Each round: write the MIDI file, build the samples, render the piece offline the way the page
plays it (`render_performance.mjs`), then measure it against the record from 0:18 to 5:00
(`calibrate.py`, `attack_ring.py`, `hiss_level.py`, `width.py`, `room_score.py`).

- **Samples.** Salamander records every minor third; the samples were moved 32.1 cents down to
  the record's pitch when built, so no note is shifted more than a semitone. Velocity layer 8
  plays the notes the model heard softer than 64, layer 10 the louder ones. Layers 6, 8, 10 and
  12 were each rendered whole; their attacks against the record's (2, 4 and 8 kHz) could not
  separate them cleanly, and 10 came out a little flatter, so the loud notes get it.
- **Loudness per note.** Each note's rise in its first four partials, 20-100 ms after the
  onset, against the record's: four rounds of corrections took the spread from an
  interquartile range of -3.5..+3.7 dB to -0.2..+0.2 dB (5-95%: -9.0..+9.1 to -1.1..+3.8), on
  the 591 notes clear enough to measure.
- **The hiss.** Pink noise, independent in each channel, loops under the piece; set so the
  quietest tenth of 50 ms windows above 7 kHz sits 53.2 dB under the music, as the record's does.
  The steady tone at 51.93 Hz on the record (-70.8 dBFS, 38 dB under the music's average) was
  left out: too low and too quiet to hear on most speakers.
- **The room.** Nine settings of the engine's reverb over 1:00-2:30. None filled the record's
  quiet moments: the render's quietest tenth stays 5-12 dB emptier than the record's from
  250 Hz to 4 kHz whatever the room, because the record's glides fill them. So the choice went
  by how bright the ring is against the attack: the hall, mix 0.9, size 0.8, decay 0.9, tone 1,
  came closest.
- **Tone.** Third-octave corrections from the loop, up to 2.5 kHz. Above that the record's
  spectrum holds its glides and its floor, so the loop's numbers were not used there. Measured
  on the attacks alone (the first 30 ms of clear onsets, what sounded before taken away), the
  piano's strike was 2-5 dB darker than the record's; its ring, 150-400 ms on, was 8-14 dB
  darker above 2 kHz. A flat 3 dB of treble barely moved that, so strike and ring were voiced
  apart, as the Mango guitar's were: +3 dB above 2.5 kHz for the first 30 ms, +10 dB for the
  ring, crossfaded by 60 ms. After it the strike is within 2 dB of the record's from 2 to
  12 kHz and the ring 3.5-7.8 dB darker; the long-term spectrum is within 1.96 dB per third
  octave from 63 Hz to 8 kHz (first render: 4.07).
- **Width.** The first renders were almost uncorrelated between the channels from 125 Hz up
  (0.12-0.21 against the record's 0.72-0.78): Salamander's spaced pair and a wide reverb. The
  samples are narrowed to 0.3 of their side signal and leaned toward the record's
  left-minus-right level at their fundamentals (6.1 dB left at 63 Hz to 0.8 dB right at 4 kHz),
  and the reverb's width is 0.3: per octave the correlation is now within 0.04 of the record's
  on average and the lean within 1.5 dB.
- **Level.** Active level -32.1 dBFS against the record's -32.3.

## 2026-09-27: the other layers, first pass

Luke asked to push on the other sounds too. The first pass, while the piano shipped on its own
(9d4a4a5):

- **The glides** are the biggest of them: whole rows of lines, 100 Hz to about 2.5 kHz, bending
  up and down together, often two at once, plus one plain sine arch from 500 to 750 Hz and back
  (0:09.8-0:12.8). A tracker that assumed one buzzy tone and followed its fundamental by
  harmonic sum (35-140 Hz, the piano's steady partials taken out with a 3 s median;
  `glide_track.py`) failed: it pinned to the top of its range. Measured directly on the intro,
  the lines' spacing wandered from 23 to 34 Hz, smallest where the arcs are highest, which one
  harmonic tone cannot do.
- **The chirps** (short blips at 1.75, 3 and 5 kHz), **the buzz** at 3:24-3:32 and **the whoosh**
  at 4:16-4:21 were located and described (the table above) but not measured further.

## 2026-09-27: the glides are a chromatic cluster

Two neighbouring arcs, tracked from 0.2 to 4 s with a 16384-point FFT, settled it. From 588 to
992 Hz successive lines stand in a constant ratio, 1.056 to 1.065: a semitone (1.0595), not a
harmonic series (constant spacing). And every line moves by the same ratio (0.92-0.95 of its
height at 1.5 s, a few seconds either side). So the glides are a cluster of pure tones, one on
every semitone, bent up and down together, as a chord would be under one pitch wheel.

**Tracking it** (`cluster_track.py`). The spectrogram's moving part (each bin minus its median
over 3 s) against a comb of semitone-spaced lines, for every offset from 0 to 99 cents, every
50 ms; the best path through the offsets (circular, at most 25 cents a frame) unwrapped is the
cluster's pitch. With 12 cents a frame it lost the faster sweeps near the end; with 25 it holds.
What it found:

- 0:00-0:57: a clean triangle, about 16 semitones down over 8.5 s and back up, every 17 s or so,
  the comb standing 3.7-3.8 dB over the other offsets;
- 3:15-3:36 and 4:02 to the end: the same sweeps, faster in places;
- in between, under the dense piano, the comb stands no higher than elsewhere (about 1.3 dB,
  the noise), so the cluster is weak or absent there and is not played.

**Building it** (`cluster_notes.py`, `make_midi.py --glides`). On the app's synth: one sine per
semitone from C2 to D#7 (64 notes), all on one synth part, sharing one pitch curve (the tracked
path, a 0.5 s median) and one level curve, which the MIDI file carries as channel 2's pitch bend
(a range of 24 semitones) and CC 11. The page reads them as each note's expression, as Blade
Runner Blues's CS-80 notes are read. Two things had to change after the first render:

- *Where it sits.* Each line's level was first read only over the tracker's band (262 Hz to
  2.5 kHz), and the render's fan sat more than an octave above the record's. Read on the raw
  spectrum over the intro's first 18 s instead (the level half a semitone off the line cannot
  serve as the reference: below about 200 Hz the lines are closer than the FFT resolves), the
  levels are within about 10 dB from C2 to C6 and fall above; the fan now sits at 100 Hz to
  1.2 kHz, as the record's does.
- *Its level.* Set from the comb's salience, the cluster fell silent wherever the glide turns
  (its lines stand still there, and the 3 s median takes them), while the record's fan is as
  bright at its turns as anywhere. It now holds one level within each span (gaps under 6 s
  bridged, 1 s fades at the edges), each span's level set against the record on the comb lines:
  0:03-0:58 at -8.7 dB, 3:15-3:36 at -2.2 dB, 4:02 to the end at 0 dB. On the comb lines the
  render is now within 0.4, 0.5 and 1.4 dB of the record in the three spans.
- *The end.* From 4:44 the record's fan dies away into single sine arches, while the tracker's
  path wanders. Fading the cluster out there took the loudness contour's correlation from 0.846
  to 0.733: the record still holds fan and arches at about -40 dBFS, and the replica without
  them fell far below it. So the cluster plays on to the end; its motion in those 17 seconds is
  approximate.

On the page the first build lit every key on the keyboard for as long as the cluster sounds and
filled the notes view with 64 lines, burying the piano. The glide notes are now marked as a
sound under the music: they light no key and the notes view leaves them out (a new `unlit`
flag on a score's notes, with a test that a glide note beside a piano note on the same key
neither lights it nor, when it ends, puts it out).

The glides took the loudness contour's correlation from 0.754 to 0.846 and filled the replica's
quiet moments: at 250 and 500 Hz they are now 2.0 and 0.7 dB emptier than the record's, where
the piano alone left them 11 and 10 dB emptier. The single sine arches, the chirps, the buzz
and the whoosh are still not played.

## 2026-09-27: where it stands

The piano, rendered offline the way the page plays it, against the record from 0:18 to 5:00:

| | first render | the piano (9d4a4a5) | with the glides |
|---|---|---|---|
| notes | 1,206 (ByteDance, mix) | 1,385 (two ByteDance runs, disputed notes settled by synthesis) | the same, and 320 glide notes |
| notes checked by eye, 0:18.3-0:25 | | 12 of 15 right, 3 uncertain, none missing | the same |
| loudness per note, record minus render | IQR -3.4..+3.7 dB, 5-95% -9.0..+9.1 | IQR -0.2..+0.2 dB, 5-95% -1.1..+3.8 | IQR -0.2..+0.2 dB, 5-95% -1.3..+3.8 |
| loudness contour, 100 ms | r 0.679 | r 0.754 | r 0.846 |
| long-term spectrum, 63 Hz-8 kHz, per third octave | 4.07 dB | 1.96 dB | 1.95 dB |
| the strike at 2, 4, 8 and 12 kHz, record minus render | +4.6, -3.4, +8.1, +27.1 dB | +2.0, +0.9, +2.3, +2.2 dB | +2.7, +1.0, +2.8, +3.1 dB |
| the ring at 2, 4 and 8 kHz, record minus render | +6.3, +7.2, +21.4 dB | +4.0, +2.6, +6.8 dB | +3.9, +2.6, +7.6 dB |
| quiet moments at 250 Hz, 500 Hz, 1, 2, 4 and 8 kHz, render minus record | -11.9, -11.7, -10.4, -11.6, -15.4, -31.8 dB | -11.2, -9.9, -8.8, -9.4, -6.0, +6.8 dB | -2.0, -0.7, -4.8, -8.0, -5.8, +7.0 dB |
| width, left/right correlation per octave, mean error | 0.40 | 0.06 | 0.06 |
| lean, left minus right per octave, mean error | 2.6 dB | 1.4 dB | 1.4 dB |
| hiss under the music | none | 53.2 dB (record 53.2) | 53.2 dB |
| active level | -34.0 dBFS | -32.1 dBFS (record -32.3) | -32.1 dBFS |

On the site the piece loads only the 48 recordings it plays (27 positions, two layers), 3.5 MB,
when it starts.

**Still open.** The single sine arches, the chirps, the buzz and the whoosh; the glides' motion
in the last 17 seconds; a cluster in the middle of the piece, if one is there under the piano;
the fan's brightness moving across its lines, which the record's does and one fixed set of line
levels cannot. The ring is still a few dB darker than the record's above 2 kHz. Three of fifteen notes in the checked excerpt are
uncertain, and nothing past that excerpt was checked by eye. Decay by register and chorus in
the partials were not measured, so a CP-80 is ruled out by inharmonicity alone. Nobody has
listened to it yet: that is next, with the A/B files.

## The tools

| Tool | What it measured | What it decided |
|---|---|---|
| yt-dlp (via uvx), ffmpeg | the two uploads: level, width, spectrum to 20 kHz | the label's upload, 8-13 dB more above 16 kHz |
| tuning.py | peak frequencies against A440, per 10 s | -32.1 cents, steady; samples built at that pitch |
| first_look (constant-Q pictures, loudness, chroma, stereo) | the form, the harmony, the stereo lean | where the piano is exposed; the lean to copy |
| Demucs htdemucs_6s, 8 seeded offsets | six stems | no stem is the piano; the buzz and whoosh found in drums and vocals |
| instrument_tests.py | inharmonicity, decay by register | an acoustic grand, not a CP-80: Salamander |
| below_f0.py | the knock under high notes | close to the C5's |
| run_bytedance.py (piano-transcription-inference 0.1.0) | notes, velocities, pedal | the transcription and the pedal |
| run_basic_pitch.py (basic-pitch 0.4.0) | notes | cross-check only: F1 0.40, it splits held notes |
| agree.py | onset F1 between lists | the two ByteDance runs agree at 0.79 |
| arbitrate.py | each disputed note's effect on the spectrogram | 386 lone notes kept, 140 dropped |
| overlay.py | notes over the constant-Q picture | the check by eye |
| calibrate.py | tone per third octave, loudness per note, contour | four rounds of EQ and velocity |
| attack_ring.py | strike, ring and floor per octave | strike and ring voiced apart; the layer choice |
| room_score.py | ring against attack, quiet-moment fill, tone per reverb | the hall at 0.9 |
| width.py | correlation and lean per octave | samples at 0.3 width, leaned; reverb width 0.3 |
| hiss_level.py, noise_floor.py | the floor above 7 kHz, hum lines | pink hiss 53.2 dB under; the 51.93 Hz tone left out |
| glide_track.py | the glides' fundamental, as if one buzzy tone | failed: they are not one tone |
| cluster_track.py | the glides as a semitone comb: pitch path, salience, line levels | a chromatic cluster; where it plays |
| cluster_notes.py | the cluster's spans and level against the record | 64 sines on one part, three span levels |
| render_performance.mjs | the piece as the page plays it | every number above |
