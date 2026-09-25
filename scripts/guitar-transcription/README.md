# Guitar transcription

How "Pernambuco" (`public/midi/performances/pernambuco.mid`) and its recordings
(`public/samples/nylon-guitar/pernambuco/`) were made from Luiz Bonfá's 1959 record
(*Solo in Rio 1959*, Smithsonian Folkways SFW40483; one nylon-strung Do Souto guitar, recorded
live in Rio on a mono Nagra III). The record itself is never committed: it is fetched into a
scratch folder, analysed there, and only the notes and the measured tone leave it.

The approach is analysis by synthesis. Three published guitar-transcription models propose the
notes; a model of the recording then explains its spectrogram as the sum of those notes, each
one the University of Iowa recording of its exact string, fret and stroke, and fits everything
a player controls: when each note starts and stops (ringing, damped or muted by the thumb),
how loud and how bright each stroke is, which string it is on, which notes are missing or
spurious. It also fits how Bonfá's guitar and tape differ from the Iowa guitar: an equaliser,
a faster decay of the upper partials, a per-pitch balance of partials and the room. Those
curves then voice the samples, and renders of the result are measured against the record in a
closed loop.

## Setup

Python 3.11 and ffmpeg (7.1 here). Three environments, since the models pin their own stacks:

```bash
uv venv analysis -p 3.11 && VIRTUAL_ENV=analysis uv pip install -r requirements.txt
uv venv models -p 3.11 && VIRTUAL_ENV=models uv pip install "git+https://github.com/xavriley/hf_midi_transcription.git@96f6797881e9497cbfc8f8e5deccea9c1f2f7adc"
uv venv bp -p 3.11 && VIRTUAL_ENV=bp uv pip install basic-pitch==0.4.0 onnxruntime==1.30.0 "setuptools<70"
```

The QMUL checkpoints (MIT) come from `huggingface.co/xavriley/midi-transcription-models`:
`guitar-gaps.pth`, `guitar-gaps-paper-version-12200_iterations.pth` (GAPS, classical guitar)
and `guitar-fl.pth` (trained on fingerstyle recordings that include three Bonfá tracks from
this same album). The Iowa guitar is `Guitar.mono.2496.zip` from
<https://theremin.music.uiowa.edu/MISguitar.html> (627 MB; "may be downloaded and used for any
projects, without restrictions").

## Steps, as run for Pernambuco

All paths below are in a scratch folder; `T=scripts/guitar-transcription`.

1. The record: `yt-dlp -f 251` (Opus, 105 kbps, content to 20 kHz; the AAC stream stops at
   16 kHz) from `youtube.com/watch?v=iHwl9fxmRpc`, decoded to `record.wav`. It is mono (L/R
   correlation 0.9996).
2. Pitch and speed: `tuning.py record.wav` finds it 41.7 cents above A440, steady to ±2 cents
   over the whole track (older transfers of this material are documented running 31-77 cents
   sharp). `speed_correct.py record.wav fixed.wav 41.7` resamples it to A440; every analysis
   runs on this timeline and `make_midi.py` maps back to the record's.
3. Timing: `onsets.py fixed.wav onsets.json` (plucks to a few ms) and
   `beats_and_form.py fixed.wav form.png beats.json` (109.8 BPM; 32-beat sections, repeating
   at 96 and 128 beats).
4. Notes: `run_qmul.py` with each of the three checkpoints and `run_basic_pitch.py fixed.wav bp 0.5 0.3`,
   then `consensus.py guitar-gaps,guitar-gaps-paper-version-12200_iterations,guitar-fl,bp consensus.json`.
   The two strongest checkpoints agree at onset F1 0.91 (20 ms); basic-pitch agrees with any
   of them at 0.67-0.73 and only shapes the clusters' onsets.
5. Takes and representation: `iowa.py <2496mono dir> takes.pkl`, then
   `features.py fixed.wav takes.pkl features.pkl`.
6. The fit: `stage1_consensus.py features.pkl consensus.json stage1.pkl`,
   `stage2_prune.py features.pkl stage1.pkl onsets.json stage2.pkl`,
   `stage3_room.py features.pkl stage2.pkl stage3.pkl`. Each prints the model's cost and the
   fraction of the recording's energy it misses and adds.
7. First MIDI and samples: `make_midi.py features.pkl stage3.pkl beats.json pernambuco.mid`,
   `build_samples.py <2496mono dir> stage3.pkl pernambuco.mid public/samples/nylon-guitar/pernambuco`
   (the renderer and the page read them there), then render it the way the page plays it:
   `node scripts/render_performance.mjs --piece performance-pernambuco --midi pernambuco.mid --out render.wav`.
8. Ghost strokes: `compare.py record.wav render.wav cmp --unmatched unmatched.json` lists the
   record's plucks the render lacks; `stage4_ghosts.py features.pkl stage3.pkl unmatched.json stage4.pkl`
   adds the heavily muted thumb strokes the audio supports.
9. Closed loop: render, then `calibrate.py record.wav render.wav stage4.pkl features.pkl calib.json`
   measures the long-term spectrum and every note's loudness against the record; feed the
   rounds back with `make_midi.py ... --loudness calib_a.json,calib_b.json` and
   `build_samples.py ... --tone calib_a.json,calib_b.json` and repeat.

10. The recording chain: `noise_floor.py record.wav floor.json` shows the record's floor is flat
    tape hiss above 3 kHz (no mains hum), so the page lays looping white noise under the piece;
    `hiss_level.py record.wav render.wav` sets its gain (44.2 dB under the music on the record).
    `room_sweep.py` renders the opening under each reverb setting and keeps the one closest to
    the record (mono, mix 0.9, size 0.6, decay 0.8 of 47 tried).

`viz_cqt.py` draws pitch-grid spectrogram pages with notes overlaid; `viz_fit.py` draws the
recording, the model and their difference, which is how the fit's failures were found.

## Where it stands

The shipped version rendered offline and compared with the record: per-note loudness error IQR
-0.2..+0.3 dB (5-95%: -1.0..+1.3 dB), 100 ms loudness contour r = 0.948, long-term spectrum
within about 2 dB from 62 Hz to 16 kHz, tape hiss 43.9 dB under the music (record 44.2), onsets
at +2.9 ms median (F1 0.835 against a detector that also hears finger noise), log-CQT similarity
0.940, chroma similarity 0.958.

Not modelled: the tape's flutter (about 2.4 cents at 19 Hz) and finger noise on the wound
strings. The pianissimo takes of the low E string above the 7th fret do not split cleanly (15
plucks for 12 notes) and are left out; the piece does not play them.
