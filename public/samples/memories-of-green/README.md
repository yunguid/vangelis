# Memories of Green piano samples

Salamander Grand Piano V3 by Alexander Holm: a Yamaha C5 grand recorded with
two AKG C414 in an AB pair about 12 cm above the strings, 48 kHz / 24 bit.
Licensed under Creative Commons Attribution 3.0 Unported
(https://creativecommons.org/licenses/by/3.0/). These files are edited from
the originals as described below.

Upstream: https://github.com/sfzinstruments/SalamanderGrandPiano/tree/master/Samples
(retrieved September 27, 2026).

Only the recordings the piece plays are here: `<note>v<layer>.mp3` is
Salamander's `<note>v<layer>.flac` (sharps spelled "s" here), velocity layer 8
for the softer notes and 10 for the louder ones.
`scripts/piano-transcription/build_samples.py` made them from the originals and
the piece's MIDI file; per recording it:

- aligns the hammer onset to a 5 ms pre-roll;
- inverts the right channel where the spaced pair recorded the channels out of
  phase;
- lowers the pitch by 32.1 cents (a soxr resample) to the record's own tuning;
- equalises it toward the record's piano: third-octave corrections up to
  2.5 kHz from four closed-loop rounds against the record, and above that
  +10 dB for the ring and +3 dB for the first 30 ms, the hammer's strike;
- narrows the stereo pair to 0.3 of its side signal and balances it toward the
  record's left/right lean at its fundamental (the bass to the left);
- keeps it as long as the longest note that plays it sounds, plus its release
  and a 1 s raised-cosine tail;
- encodes MP3 (libmp3lame -q:a 5), stereo, 48 kHz.

Playback is a transcription played on these recordings, not the record.
