# Blade Runner Blues: the journey

Rebuilding Vangelis's "Blade Runner Blues" inside Vangelis (the app), with sounds we design
ourselves on the app's own synthesizer rather than borrowed samples. Every entry says what was
done, what was measured and what it changed; numbers come from the commands named beside them.

## 2026-09-25: the record, first look

**Source.** The EastWest 1994 album track, from its official YouTube upload ("Provided to
YouTube by EastWest U.K.", video ECYLHiXvrBQ): Opus, 140 kbps, 48 kHz stereo, 8:54.
Engineers credited: Frederick Rousseau, Philippe Colonna, Raine Shine; mastering Frederick
Rousseau and Mireille Landmann; arranged and produced by Vangelis.

**What the numbers say** (`scripts/guitar-transcription/tuning.py`, a stereo and loudness pass,
a chroma and tempogram overview):
- Tuned 11.6 cents above A440, one clear peak (resultant length 0.75): no tape drift to undo.
- Very wide stereo: left/right correlation 0.38, the side signal only 3.5 dB under the mid.
  Pernambuco was mono; this one lives in a big stereo room.
- A quiet master: peaks at -6.6 dBFS; the level sits around -33 dB for eight minutes, builds
  a little between 7:00 and 8:20, and fades from 8:30.
- No beat: the tempogram finds no steady pulse. It is played in free time.
- A 15-second fade-in of ambience, then an F# drone that holds from about 0:35 to 6:10 under
  everything, the tonal centre of the blues. Between 6:10 and 8:20 the harmony opens up
  (A, D, E, G#), then returns home.
- No hard attacks anywhere: every sound swells in.

## 2026-09-25: what the internet knows

A research pass over the album credits, Vangelis's interviews, the CS-80 manual and the
people who rebuild its sounds (sources in the research notes of this session; the key ones
below). Nobody has published how "Blues" itself was patched or played, so everything about
the sound has to come from the record.

- The canonical track is the EastWest 1994 album cut (8:53), the one Vangelis approved and
  the one the label uploaded; the 1982 bootlegs run longer.
- Sound On Sound (1995) names this piece as the demonstration of the CS-80's Initial
  Pitchbend: a scoop up into each note, scaled by how hard the key is struck, which makes
  it sound like a harmonica or a saxophone.
- The CS-80 has two complete synthesizers per key (channel I and II), each with a
  sawtooth, a pulse, noise and a sine that goes straight to the amplifier, a resonant
  high-pass and low-pass, and per-key pressure that can bring in brightness, level and
  vibrato. That is the palette to rebuild.
- Everything was mixed through a Lexicon 224 reverb; the score was played to picture,
  improvised, first takes kept.
- A blog reads the harmony as F# minor and D; the record agrees (below).

## 2026-09-25: hearing it without ears

I can't listen, so the record was turned into pictures and numbers.

**Failed attempts, kept for the record.** YourMT3+ (a multi-instrument transcription model)
heard mostly "strings" and "piano" and missed the F# drone entirely. Demucs source
separation could not isolate the CS-80: the lead moved between its "guitar" and "other"
stems from one section to the next. A first pitch tracker read the lead's fundamental and
drowned in the pad.

**What worked.** basic-pitch's raw note posterior (not its note list) turned out clean:
the CS-80's notes stand out as strong lines, the drone as weaker continuous ones. From it,
a slow layer (keys held for seconds) and a fast layer (played notes).

**The lead, measured.** A linear spectrogram of a single note settled what the CS-80 is
doing here: its harmonics run clean all the way to 16 kHz, every one of them curves
upward at the start of a note (the Initial Pitchbend), and after a second or so they
all start to wave together (vibrato). Reading pitch from those high harmonics, where a
cent is a wide target, gives clean curves:

- each note scoops up from 20-50 cents flat over about 0.3 s;
- vibrato comes in bursts, slow (2.2-2.5 Hz) and wide (+-10-15 cents), then settles;
- held notes sit 12-16 cents sharp of A440.

The harmonic make-up (median of 57 notes from E4 to D5) is a sine plus a sawtooth at
0.87 of its level, through a low-pass near 8 kHz with a little resonance: the second
harmonic 12.7 dB under the first, the tenth 27.7 dB under. The model matches harmonics 2,
3, 5 and 10 within about a dB. That is the CS-80's sine lever beside a sawtooth channel.

**The pad, fitted.** The record's spectrum, with the CS-80's harmonics masked out, was
explained as notes sharing one learned tone (shift-invariant NMF). The tone: a
fundamental, its octave 7 dB down, then almost nothing (the third 29 dB down). A sine
frequency-modulated at its own frequency with an index of 0.75 has exactly that spectrum.
The fit also gives every pad note its swell, and it found the harmony: F#m7 with a ninth
for the opening, a D bass arriving around 0:43, and the move to D, A and E after 6:00.

**Two things no note explains.** A cluster of steady tones between 30 and 52 Hz under the
whole piece from 0:12 (51.4 Hz leads at first, 44.3 Hz later; as strong in the sides as in
the middle), and a steady noise floor under the music, falling about 9 dB an octave above
400 Hz. Brighter, longer reverb did not reach the floor (it moved it 5 dB where 30-50 were
missing), so it is the recording chain, not the room.

## 2026-09-25: the synth learns to play it (v1)

The app's synth could not play this: one patch at a time, no per-note expression, notes
started whenever a timer fired. Now (commit a02b5a9) a score can bring **parts**, each a
set of synth nodes with its own patch sharing the effects chain, and each note can carry
its own **expression curves** (pitch in cents, gain, filter), read per sample, started on
the audio clock. Existing sounds render bit-for-bit as before.

The piece is four parts, all the app's own synth plus one synthesized noise:

- **cs80**: two layers per key, a sine (the sine lever) and a sawtooth started half a
  cycle on so its fundamental adds to the sine's, low-passed at 8 kHz. 191 notes, each
  with the record's pitch and loudness curves.
- **pad**: a sine FM'd at ratio 1, index 0.75. 559 notes with their swells.
- **rumble**: eleven held sines at the bed's exact frequencies, their levels following
  the record's six spans, two detuned voices each for width.
- **the floor**: pink noise through a 400 Hz low-pass and a 250 Hz high-pass, looped.

The MIDI file is MPE-style: every note on a voice track of its own, its pitch as pitch
bend, its loudness as CC 11. 87 KB.

**A bug worth logging.** The first renders had no scoops, no vibrato and no tuning:
@tonejs/midi hands pitch bends over as -1..1, and the reader treated them as raw 14-bit
values, shrinking every curve 8192 times. A test now round-trips a real file.

**Closing the loop.** Each render is read back with the same tools as the record: four
rounds of per-note loudness corrections, part levels from stems, a reverb sweep, the noise
bed set octave by octave.

**Where v1 stands** (rendered offline the way the page plays it):

| | record | replica v1 |
|---|---|---|
| CS-80 pitch, per note | | within 1.1 cents (median; IQR 0.8-1.5) |
| CS-80 peak loudness, per note | | within 1.6 dB for 80% of notes |
| level, 0:15-8:45 | -30.3 dBFS RMS | -30.0 dBFS RMS |
| stereo width (L/R correlation) | 0.38 | 0.36 |
| floor, every octave 100 Hz-12.8 kHz | | within 4 dB |
| picture distance (constant-Q, 60 dB range) | | 5.9-7.9 dB mean |

**Not yet**: about thirty low booms (short hits under 200 Hz, unexplained), the pad's
upper voices (the fit keeps few), the CS-80's exact filter and brilliance per note, and a
room fitted past the first sweep. Next: Luke's ears on v1.

## 2026-09-25: v1 goes live

Luke: "push the blade runner blues v1 to master". v1 went to main and joined the landing
queue beside Pernambuco and the lullaby, as he had asked for the finished piece. The page
plays it on its own synth parts; the keys keep the listener's sound while it plays.

## 2026-09-25: seven analysts, three skeptics, and v2

Luke asked for another pass: several agents at once, pushing further, and the sounds brought
into the app so he can play them later. Seven analysts each took one dimension (the CS-80's
tone, its notes, the pad, everything under 200 Hz, the room, the mix, playable sounds) and
had to prove every proposal by rendering it; three skeptics then re-measured each proposal,
on stretches of the piece the analyst had not tuned on. Of 34 proposals, 24 were confirmed,
5 refuted and 5 left inconclusive. v2 is what survived, put together and measured as a whole.

**The biggest find was a bug in how we read the record.** basic-pitch does not space its
frames 256 samples apart across a file: it runs its model on windows hopped by 36,164 samples
and keeps 142 frames of each, so frame i sits 0.52% later than i x 256 / 22,050 s. v1 assumed
the even spacing, and its CS-80 ran progressively late: 0.4 s at 3:30, 1.8 s at 8:00. v1's
"1.1 cents" and "1.6 dB" could not see it: they compared render and record inside the same
misplaced windows. It also explained why so many second-half measurements disagreed with the
first half's. With the frames mapped properly the lead lands on the record in every minute.

**What changed, and why** (each confirmed by a skeptic):

- *151 lead notes put back.* The test that drops "held pad keys" also dropped long legato
  CS-80 notes (the slow layer holds anything held for 2 s). Each dropped note was tracked,
  rendered back in, and kept if its own stretch of the record's picture came closer by more
  than 0.5 dB: 342 notes where v1 had 191 (`lead_keep.json`).
- *The pad's upper voices.* The pad fit read the record through a constant-Q transform that
  reads a sine 3 dB quieter for every octave up, so it kept a tenth of the voices above C5.
  Undone, the pad has 734 notes (v1: 559), and the stretches with pad notes above C5 more
  than double.
- *A brighter pad.* At harmonics no tempered note can sit on (F#2's 7th, 13th and 14th), the
  record has 18-27 dB under the fundamental, where v1's FM sine has nothing. A sine beside a
  half-cycle-shifted saw, low-passed at 5 kHz, fits. (v1's note that FM index 0.75 gives a
  third harmonic 29 dB down was wrong twice: the engine gives 22 dB, and the 29 came from the
  tilted reading.)
- *The booms are a bass line.* The thirty-odd short low hits are the onsets of 79 struck notes
  in the middle of the stereo picture (left/right correlation 0.92, where the pad's are near
  0), a fundamental and its octave. They get a part of their own (`bass_notes.py`); the note
  at 7:10 is an A1 re-strike the pitch vote misread as G1.
- *The low bed is a loop.* It repeats every 1.692 s, so its lines sit on a 0.591 Hz grid:
  21 lines with their levels every 4 s, starting at 0:12.2 where v1 faded in over 24 s
  (`bed_lines.py`).
- *The CS-80's top.* The record's lead has energy up to ~10 kHz that v1's 8 kHz low-pass cut:
  the saw opens to 9.5 kHz. And the record's lead darkens up the keyboard, so the sine layer
  grows with the key.
- *The room.* v1 only looked right on width (0.36 against 0.38) because two errors cancelled:
  too wide below 500 Hz and nearly mono above 1 kHz. Of the engine's rooms, ambient at full
  mix, decay and tone, size 0.8, comes closest band by band on the lead's own harmonics.
- *The floor* is brighter (low-passes at 1.4 and 4 kHz) and cut under 100 Hz, with a subsonic
  rumble under it, as the record's quietest moments are.
- *The bed's own envelope.* On the page the noise bed took the listener's decay and sustain
  (2.4 dB low with the default sound, silent with a plucky one), while every render assumed it
  held. It now holds its own level, fades in over 3 s and out over the last 4.2 s.
- *Low pad notes cut* wherever the pad alone is louder at a note's fundamental than what the
  record leaves there (`pad_fix.py`), and one last loudness round for the CS-80.

**What did not survive.** Per-note brightness carried as CC 74 was fitted on the misplaced
notes; a darker patch after 5:00 was answering a "second voice" that the timing bug had made;
per-part reverb sends would comb on the page (the compressor and wave-shaper delay the dry
path 10 ms, so a send taken before them arrives early); both one-layer CS-80 presets were too
thin at the fundamental or too dark at the top. Left out as unproven: 40 lead notes below A3
(some may be the booms' harmonics) and 8 held low pad notes. Pad level following the key was
confirmed on v1's notes, but it was compensating the constant-Q tilt: with the tilt undone the
pad sits within 1 dB of the record in every register, and it would count twice.

**Setting the levels.** Put together at the analysts' own gains, v2 played 2.5 dB loud, and
each proposal's own level compensation had been fitted to a different mix. Instead every part
was rendered on its own and set where it carries at least 85% of the sound, against the
record in the same cells: the pad and the bed at 0 dB there, the bass and the CS-80 within
1.5 dB. The CS-80's last loudness round came after.

**Where v2 stands** (rendered offline the way the page plays it; 0:15-8:45 unless said):

| | record | v1 | v2 |
|---|---|---|---|
| level (both channels' mean square) | -28.64 dBFS | -28.36 | -28.66 |
| stereo width (L/R correlation) | 0.380 | 0.361 | 0.388 |
| per band, 63 Hz-8 kHz: mean L/R-correlation error / side-to-mid error | | 0.31 / 5.2 dB | 0.18 / 2.1 dB |
| CS-80 timing, lag per minute | | 0 to +1.8 s | 0.00 s |
| CS-80 notes within 1.6 dB of the record's peak | | 65% (191 notes) | 93% (342 notes) |
| CS-80 pitch, median per note | | 0.9 cents | 0.8 cents |
| lead notes missing (A3 and up, dB-seconds) | | 4,588 | 757 |
| picture distance (constant-Q, 60 dB range), 0:10-8:40 | | 6.45 dB | 5.66 dB |
| same, in six windows across the piece | | 5.93-7.88 | 5.32-6.79 |
| long-term spectrum, mean per third octave | | 3.11 dB | 1.21 dB |
| 10 s windows: level / spectral shape | | 1.18 / 4.77 dB | 0.74 / 2.14 dB |
| low end, 25-200 Hz third octaves per 2 s | | 4.54 dB | 2.71 dB |
| pad-only stretches: bands / picture | | 6.22 / 8.17 dB | 2.40 / 7.08 dB |
| floor, every octave 100 Hz-12.8 kHz | | within 6.2 dB | within 1.9 dB |
| fade-in, first 15 s (K-weighted) | | 5.63 dB | 1.91 dB |
| ending, 8:45-8:54 (K-weighted) | | 3.67 dB | 3.77 dB |

**Still open.** The ending: the record's master fade starts around 8:20, and in the last
second v2 is 12-16 dB quieter than the record (a longer bed fade measured worse). The stereo
in the pad-only stretches got a little further from the record (L/R error 0.14 to 0.18), and
the lowest octave is too wide (0.28 against 0.62). The bass sits in the middle while the
record's leans 2 dB left (the engine has no per-part pan), and a third of the bass pitches
rest on a vote (the note at 7:10 was one it got wrong). The record's pad shimmers
independently in each channel, which a stereo reverb with modulation might give; the engine's
cannot. Nobody has listened to v2 yet: that is next, with the A/B files.

## 2026-09-25: the sounds, in the app

The replica's sounds are now on the sound dial, in a band of their own after Acoustic
(`src/data/bladeRunnerSounds.js`), built from the piece's own patches so they cannot drift
apart: **CS-80 Blues**, **Blues Pad**, **Offworld Drone** and **Blade Runner Boom**.

A faithful CS-80 needs its two channels: every one-layer attempt was either thin at the
fundamental or dull at the top. So the engine learned to play the keys on layers: a sound
with `layers` puts a synth node per layer under the keys, and every key's note goes to all of
them with one start time, 10 ms ahead, so they start on the same sample. That matters: in the
browser, starting the saw 32 samples late cost the fundamental 12 dB. The pad is layered the
same way. From the keys, the CS-80 gets what each note of the piece gets from the record: a
scoop into the note, a slow vibrato, a fall after the attack (measured from the record's
notes before the timing fix was found; the skeptic confirmed the layered sound on the first
2:15, where the timeline was still right). An edit in the Sound tab reaches every layer, and a
saved sound keeps its layers. The editor's tracks have one patch each, so layered sounds stay
out of their sound browser for now.

Proposed and confirmed but not built: a mod-route "via" (a velocity-scaled scoop) and a
delayed vibrato. They would bring the CS-80's gestures closer, but they grow the synth
worklet, which is already over its size budget (D14), and that is Luke's call.
