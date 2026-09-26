# The Shade of the Mango Tree: the journey

Rebuilding Luiz Bonfá's guitar on "The Shade of the Mango Tree" ("Na Sombra da Mangueira")
inside Vangelis, note by note, from the University of Iowa guitar recordings, the way
Pernambuco was rebuilt. Luke asked for the song to open the page as another option, without
the drums or the bass line, with the guitar reconstructed from the ground up. Every entry
says what was done, what was measured and what it changed; the commands are in
`scripts/guitar-transcription/README.md`.

## 2026-09-26: the record

**Source.** The album's official YouTube upload ("Provided to YouTube by The Orchard
Enterprises", Luiz Bonfá - Topic, video PJ4XqEqMM1A; *Bonfa Burrows Brazil*, ℗ 1999 Bonfa's
Productions): Opus, 141 kbps, 48 kHz stereo, 3:54. The album was recorded in 1978 at Studio
139, Sydney (engineer Wyn Wynyard) with Don Burrows (flutes, saxophone, percussion), George
Golla (guitars), Paul Baker and George Andre (bass), Doug Gallagher and Jose Boto (drums,
congas), Tony Ansell (piano) and strings arranged by Julian Lee. It is the record Nujabes
sampled for "Lady Brown". The installed yt-dlp (2026.03.17) was refused by YouTube (HTTP
403); 2026.08.19, run through `uvx` without touching the installed one, fetched it.

**What the numbers say.**
- A near-mono mix: left/right correlation 0.91, the side signal 13 dB under the middle; only
  the top octaves (5-12 kHz, correlation 0.69) are wide.
- The guitar sits 7.5 cents above A440 and holds it to within about a cent and a half for
  the whole song (every ten seconds between +6.3 and +8.9). The flute sits at +10.8 and the
  bass at -2.6, so this is the guitar's own tuning, not tape speed; the fit still runs on a
  copy moved to A440 and the MIDI carries +7.5 cents, as Pernambuco's carries its +41.7.
- The music runs from 0.35 s to 232 s, with digital silence either side.

## 2026-09-26: taking the band apart

Demucs (htdemucs_6s) split the record into six stems in a minute. Their levels over time
show the arrangement:

- 0:00-0:33, the guitar alone: the Bm, A, G run with the melody on top that "Lady Brown"
  loops. Here Demucs files part of Bonfá's thumb bass under "bass" (the stem's notes are the
  guitar's own B2, A2, G2 on the guitar's onsets), so the fit's target is the guitar stem
  plus the bass stem until 32.6 s.
- 0:33 on, the band: a bass player an octave under the guitar's bass (B1, F#1), a light kit,
  and Don Burrows's flute on the melody; at 3:29 a sustained chord of five or six voices
  comes in (most likely the strings). From here the bass stem is the bass player's, and the
  target is the guitar stem alone.
- Around 1:45-2:15 the flute takes a solo and the guitar drops 5-9 dB under it.
- A transcription someone published of the song lists flute, one acoustic guitar, strings
  and drums: one guitar, Bonfá's.

**A separation is not one answer.** Demucs runs the model on the record shifted by a random
offset. Two runs of the same command gave guitar stems that differ by a signal only 18.7 dB
under the guitar (bass 21.6 dB, other 17.1 dB): how much of a sound goes to which stem is
uncertain enough to move with half a second of offset. `separate.py` now averages eight
offsets and seeds them, so the stems the fit explains are steadier and a rerun gives the same
files.

## 2026-09-26: the first draft, and what fills the gaps

A draft fit (one-pass stems; stages 1 and 2: 2,475 notes, 226 recordings, 2.2 MB) rendered
the way the page plays it and compared with the guitar target over the whole song: loudness
contour r 0.908, log-CQT similarity 0.916, chroma 0.949, plucks matched at F1 0.80 with a
median timing error of 0.0 ms. The intro's pictures match note for note.

Two things the numbers pointed at:

- **Below 150 Hz the stems cannot be trusted once the band plays.** The render carries 5 dB
  more around 100 Hz than the guitar stem there, because Demucs files the guitar's own low
  end (thumb notes, open strings ringing in sympathy) under "bass" beside the bass player.
  In the solo intro nothing else plays until the flute comes in near 0:20 (the "drums"
  stem's content there, 19-40 dB under the record, is broadband thumps that land on the
  guitar's own plucks), so the record's first 20 seconds are the reference for the guitar's
  tone, room and width.
- **The record's gaps are fuller.** Frame by frame, the record's quietest frames sit 11 dB
  under its loudest; the render's sat 15 dB under, and no reverb setting moved that (45
  tried). The fitted model matches the record's spread only with its noise floor (-10.5 dB
  against -11.1; its notes alone give -14.2). What the floor is: in the record's quietest
  frames the 4-16 kHz octaves stay within 1.6-3.6 dB of their average, while the render's
  fall 10 dB. It is tape hiss, steady in both channels, falling about 3.5 dB an octave above
  5 kHz. Measured as Pernambuco's was (the quietest tenth of 50 ms windows above 7 kHz
  against the music; that measure gives Pernambuco's 44.2 dB exactly), it sits 48.7 dB under
  the solo guitar, and the top octaves' median is only 3.1 dB above it. So this piece gets
  Pernambuco's hiss bed too, at its own level.

## 2026-09-26: the transcription (v1)

**Notes.** On the eight-offset stems: the three QMUL guitar models agree at onset F1 0.80-0.84
(Pernambuco's clean solo record: 0.91), basic-pitch at 0.65-0.67; 3,899 clusters, 1,508 found
by all four. The fit (Pernambuco's toolkit, unchanged in method) kept 2,823 of the notes one
model or more found, pruned 359 that explained nothing, added 22 at plucks the models missed,
and moved 144 to other strings: 2,486 notes, missing 1.6% of the target's energy and adding
3.6% (Pernambuco's third stage: 1.3% and 4.1%). This record's room is bigger than Pernambuco's:
the model's room grid had to grow past its old edge (a tail at 0.45 of the dry note, time
constant 0.1 s, cost 1.3% under the old grid's best).

**The room.** 45 settings of the "room" reverb before the hiss, then with it 27 each of room,
plate and hall and 60 of "ambient", all rendered over the solo intro and scored against the
record: the picture score cannot tell plate, hall and ambient apart (0.943-0.944). What decides
is the four pauses in the intro (3.15, 5.30, 6.35 and 19.55 s, 20-26 dB under the playing
around them), where the record's tail is exposed: the dry render falls to -72 dB there, the
room to -61, plate -47, hall -42, the record -46. Over all four pauses the tails miss the
record by 2.1 dB (ambient), 2.8 (plate), 3.0 (hall). Ambient it is: mix 0.9, size 0.4, decay
0.8, and of twelve tone and pre-delay settings, tone 0.3 with 20 ms (pauses 2.0 dB off, frame
spread -12.5 dB against the record's -11.0). Width 0: the reverb decorrelates the channels
itself, and wider settings overshoot where the guitar lives.

**The attack.** The first closed-loop rounds would not reach the top octave. Split by time, the
reason was plain: onset by onset over 81 strokes of the intro, the render's first 25 ms carried
15-18 dB more above 10 kHz than the record's, its ring 7-9 dB more. The Iowa player's pluck is
a bright burst (a take's first 25 ms: 10-12 kHz only 13-15 dB under 1 kHz, against 75-100 dB
in its ring), which no correction of the whole note reaches without dulling the ring, and the
voicing's ±18 dB limit stopped the ring's own correction short. So `calibrate.py` now measures
the attack against the ring as well, `build_samples.py --attack` voices each take's first 20-50
ms apart, and `--clip 30` lets the ring's correction through. Two rounds later the attacks sit
within 1.2 dB of the record's up to 6 kHz.

**Where v1 stands**, rendered offline the way the page plays it:

| | against |
|---|---|
| long-term spectrum, 44 Hz-8 kHz | within 1 dB of the solo intro (1/6 octave; 11-16 kHz 2-3 dB dark) |
| the attack against its ring | within 1.2 dB up to 6 kHz, 1.6-2.3 dB bright above |
| every note's loudness | IQR -0.3..+0.3 dB, 5-95% -1.5..+1.4 dB (Pernambuco v7: -0.2..+0.3, -1.0..+1.3) |
| loudness contour, 100 ms | r 0.920 (solo intro), 0.941 (whole song, against the separated guitar) |
| log-CQT / chroma similarity | 0.941 / 0.964 (solo intro), 0.937 / 0.960 (whole song) |
| plucks | +2.9 ms median, F1 0.80 against the separated guitar |
| tape hiss under the music | 48.6 dB (record 48.7) |
| level on the page | -30.1 dBFS active, as Pernambuco |

**Not done, or not yet:** the flute, bass, drums and strings (by design: the guitar alone);
the hiss is mono where the record's is partly decorrelated (the top octave's left/right
correlation 0.99 against 0.82); 21 plucks in the solo intro that the render lacks (thumb ghost
strokes, most likely) were not added, because the thumps they would explain went to Demucs's
drums stem and the fit's target lacks them; the guitar's low end in the band sections follows
a stem that lost part of it to "bass", so bass notes there may be softer than Bonfá played
them. Next: Luke's ears.
