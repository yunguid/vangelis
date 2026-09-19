# Opening piano samples

Salamander Grand Piano V3 by Alexander Holm: a Yamaha C5 grand recorded with
two AKG C414 in an AB pair about 12 cm above the strings, 48 kHz / 24 bit.
Licensed under Creative Commons Attribution 3.0 Unported
(https://creativecommons.org/licenses/by/3.0/). These files are edited from
the originals as described below.

Upstream: https://github.com/sfzinstruments/SalamanderGrandPiano/tree/master/Samples
(retrieved September 18, 2026; also at
https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html).

Source names: `{D#2,F#2,A2,C3,D#3,F#3,A3,C4,D#4,F#4,A4,C5,D#5,F#5,A5}v6.flac`,
velocity layer 6 of 16 (soft, the layer the upstream mapping uses for MIDI
velocity 47-50). The instrument is recorded in minor thirds, so every pitch in
the opening score is at most one semitone from a recording; sharps are spelled
with "s" in the file names here. Its natural stretched tuning is kept.

`node scripts/build_opening_piano.mjs --source <dir with the .flac files>`
rebuilds the MP3s. Per note it:

- aligns the hammer onset to a 5 ms pre-roll so chords land together;
- inverts the right channel where the spaced pair recorded the two channels out
  of phase (F#3, A3, A4, C5, D#5), which would otherwise cancel up to 8 dB of
  the note on mono speakers, and caps the left/right level difference at 3 dB
  (it reached 13 dB) so a melody does not jump across the stereo field;
- trims the hand-played layer's note-to-note level onto a straight line across
  the keyboard (at most 3 dB), then applies one shared gain (peak -4 dBFS) so
  the instrument's own bass-to-treble balance survives;
- keeps 9 s of the natural decay with a 2.5 s raised-cosine tail, so no file
  ends mid-ring;
- encodes with ffmpeg/libmp3lame quality 4, stereo, 48 kHz.

No compression, equalisation or noise removal is applied. Playback is a live
instrument, not a recording of the song.
