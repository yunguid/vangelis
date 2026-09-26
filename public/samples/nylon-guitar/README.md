# Nylon-string guitar samples

University of Iowa Electronic Music Studios, Musical Instrument Samples:
a Raimundo 118 classical guitar recorded in the anechoic chamber on
December 11, 2011 (Earthworks QTC40 at 5 feet; technicians Shane Hoose and
Zach Zubow). Every fret of every string was recorded at pp, mf and ff. The
project states the recordings are "freely available on this website and may
be downloaded and used for any projects, without restrictions."

Upstream: https://theremin.music.uiowa.edu/MISguitar.html
(`Guitar.stereo.1644.1.zip`, retrieved September 19, 2026).

File names are string, fret and take: `s3f2mf.mp3` is string 3 (G), fret 2,
the mezzo-forte take. Only the takes that `public/midi/performances/
saudade-de-triana.mid` plays are here, each just long enough for its longest
note, so every note sounds from a recording of that exact string and fret and
nothing is pitch-shifted. A position plucked again within 1.5 s plays the next
softer take so no recording sounds twice in a row.

`keys/` is the playable guitar (the "Nylon Guitar" sound on the dial,
`src/data/sampledInstruments.js`): one fretted position per whole tone from
E2 to A#5 (the open low E is the only open string), so every key in that range
plays a recording at most a semitone away. Each position has its mf and ff
takes, left to ring until they are 40 dB under the pluck (5 s at most) and
faded from there. The pp takes are left out: brought up to the level line they
lift the chamber's noise by as much as 22 dB, which a note held for seconds
exposes. `--keys` builds this set; it uses the level line and the shared gain
of the piece's takes, so the instrument is as loud as the piece.

`node scripts/build_nylon_guitar.mjs --source <dir with Guitar.*.aif>`
rebuilds them. Per take it:

- splits the take out of its multi-note file (the takes rise by semitone);
- removes the chamber's rumble with a fourth-order 70 Hz high-pass (the rumble
  sat only 10-15 dB under the mf notes; the low E string is 82 Hz);
- retunes it to equal temperament from its first four partials (the guitar was
  recorded 10 to 45 cents flat);
- aligns the pluck to a 3 ms pre-roll and fades the tail;
- trims its level onto one line across the neck (-0.1 dB per semitone), because
  the player's levels wander by 20 dB and the soft takes are used for their
  gentler attack rather than for being quieter; one shared gain follows
  (peak -2 dBFS);
- mixes the two microphones to mono (they are 0.97 correlated) and encodes
  with ffmpeg/libmp3lame quality 4, 44.1 kHz.

No compression, equalisation above 70 Hz or noise reduction is applied.

`pernambuco/` holds the takes "Pernambuco" plays (`public/midi/performances/
pernambuco.mid`, a note-by-note transcription of Luiz Bonfá's 1959 recording):
one file per string, fret and stroke the transcription uses, named like the
others (`s5f2mf.mp3`). They come from the same Iowa guitar, taken from the
24-bit/96 kHz mono masters (`Guitar.mono.2496.zip`), whose noise floor sits
about 112 dB under full scale, so the pianissimo strokes are usable here.
Each take is retuned to equal temperament, then voiced to sound like Bonfá's
guitar on that tape: an equaliser and a faster decay of the upper partials,
both measured by fitting the Iowa takes to the record, plus a per-pitch
correction of the balance of partials. Every take is set on one level line,
trimmed to the longest note that plays it and encoded as mono MP3. No audio
from the record itself is in these files.

`shade-of-the-mango-tree/` holds the takes "The Shade of the Mango Tree" plays
(`public/midi/performances/shade-of-the-mango-tree.mid`, a note-by-note
transcription of Luiz Bonfá's guitar on the 1978 record *Bonfa Burrows
Brazil*), made the same way from the same 24-bit/96 kHz masters and voiced to
sound like his guitar on that record. The voicing was measured against the
guitar alone, lifted out of the band by source separation
(`scripts/guitar-transcription/separate.py`). No audio from the record itself
is in these files.
