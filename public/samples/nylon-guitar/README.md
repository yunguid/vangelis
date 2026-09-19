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
