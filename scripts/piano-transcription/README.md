# Piano transcription

How the piano on Vangelis's "Memories of Green" (*Blade Runner*, EastWest 1994, track 8)
became a MIDI file (`public/midi/performances/memories-of-green.mid`) played from Salamander
Grand V3 recordings voiced like the record's piano (`public/samples/memories-of-green/`, read
by `src/data/memoriesOfGreen.js`). The record is never committed: it is fetched into a scratch
folder and analysed there, and only notes, settings and measurements leave it. The journey,
with what each step decided and every number, is `docs/replicas/memories-of-green/JOURNEY.md`.

The approach: two runs of ByteDance's piano transcription propose the notes and the pedal,
per-note synthesis settles where they disagree, and closed loops of offline renders against
the record set each note's loudness and the samples' tone, room, width and floor. The record's
glides, a chromatic cluster, are tracked as a semitone comb and played by the app's synth.

## Setup

The environments of `scripts/guitar-transcription` (see its README): `analysis` (numpy,
scipy, librosa 0.11, soundfile, soxr, mido, matplotlib) for everything here, `bp` for
basic-pitch, `sep` for Demucs, plus one for the piano model:

```bash
uv venv amt -p 3.11 && VIRTUAL_ENV=amt uv pip install piano-transcription-inference==0.1.0 librosa soundfile
curl -L -o ~/piano_transcription_inference_data/note_F1=0.9677_pedal_F1=0.9186.pth \
  "https://zenodo.org/record/4034264/files/CRNN_note_F1%3D0.9677_pedal_F1%3D0.9186.pth?download=1"
```

(The package fetches its checkpoint with `wget`; fetch it with curl as above if there is none.)
Salamander's FLACs come from
`https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master/Samples/<note>v<layer>.flac`
(sharps as `%23`); the piece uses C1 to F#7 at layers 8 and 10.

## Steps, as run

In a scratch folder, `T=scripts/piano-transcription`, `G=scripts/guitar-transcription`.

1. The record: `uvx --from "yt-dlp[default]" yt-dlp -f "251/140/bestaudio"` from the label's
   upload (`youtube.com/watch?v=u1KfOMkyU_w`) and from Luke's link (`6uXnXEdXGJY`), each decoded
   to 48 kHz and 44.1 kHz stereo WAV. `compare_uploads.py label48.wav fan48.wav` kept the
   label's (the other has 8-13 dB less above 16 kHz): `rec48.wav`, `rec44.wav`.
2. Pitch and form: `$G/tuning.py rec48.wav` (-32.1 cents, steady), `first_look.py rec48.wav
   -32.1 pics` (loudness, stereo per octave, constant-Q pages, pitch classes).
3. Stems: `$G/separate.py rec44.wav sep htdemucs_6s --shifts 8`, then `stems.py rec44.wav sep
   -32.1 [t0 t1 out.png mix,guitar,piano,other]`. The piano moves between guitar, piano and
   other; the sum of those three is `pitched.wav`.
4. The instrument: `instrument_tests.py rec48.wav mix.json -32.1 --ref <salamander dir>`
   (inharmonicity, decay) and `below_f0.py rec48.wav render.wav mix.json -32.1`.
5. Notes: `run_bytedance.py rec44.wav -32.1 mix.json` and `run_bytedance.py pitched.wav -32.1
   pitched.json` (amt environment), `run_basic_pitch.py rec44.wav -32.1 bp_mix.json` (bp),
   `agree.py mix.json pitched.json`.
6. A first build and render: `make_midi.py mix.json r1.mid --cents -32.1 --layers 0:8,64:10`,
   `build_samples.py <salamander dir> r1.mid public/samples/memories-of-green --cents -32.1`
   (clear the folder first), `node scripts/render_performance.mjs --piece
   performance-memories-of-green --midi r1.mid --out r1.wav`, then `calibrate.py rec48.wav r1.wav
   mix.json r1.json --cents -32.1 --span 18,300`.
7. Disputed notes: `arbitrate.py rec48.wav r2.wav mix.json pitched.json
   public/samples/memories-of-green arb.json --cents -32.1` (1,385 notes).
8. The closed loop, four rounds, each as step 6 with the score `arb.json` and every earlier
   round's corrections: `make_midi.py arb.json rN.mid --cents -32.1 --layers 0:8,64:10
   --loudness r1.json,r2.json,...` and `build_samples.py ... --tone r1.json,r2.json,r3.json
   --tone-max 2500 --treble 10 --attack-treble 3 --width 0.3 --lean
   "63:6.1,125:4.8,250:2.2,500:0.3,1000:-0.4,2000:-0.2,4000:-0.8"`. The shipped file used
   loudness rounds r1, r2, r3 and r5 and tone rounds r1-r3.
9. Checks between rounds: `attack_ring.py` (strike, ring, floor per octave), `room_score.py`
   over renders made with `--from 60 --to 150 --params '{...}'` (the room), `width.py` (the
   width and lean), `$G/hiss_level.py rec48.wav render.wav --span 18,300` and `$G/noise_floor.py`
   (the hiss), `overlay.py` (notes over the picture, the check by eye).
10. The glides: `cluster_track.py rec48.wav cluster.json --step 25` (the chromatic cluster's
    pitch path, salience and line levels), `cluster_notes.py cluster.json glides.json
    --span-db -8.7,-2.2,0` (spans and levels; the span levels from a render compared with the
    record on the comb lines), then `make_midi.py ... --glides glides.json`. Glide gain on the
    page: `MOG_GLIDE_GAIN`.
11. Clean the false notes: `clean_notes.py out.mid public/midi/performances/memories-of-green.mid`
    drops the model's clicks (notes at make_midi.py's 20 ms floor: the chirps and stray blips
    such as every G#4) and merges stutters (same-key re-attacks under 0.4 s, e.g. F#6 at
    0:07-0:12, C5 at 4:28) into one held note. 1,385 notes -> 935.
12. The page's waveform: `node scripts/render_performance.mjs --piece
    performance-memories-of-green --out x.wav --peaks public/midi/performances/memories-of-green.waveform.json`.

`piano_score.py` holds the pedal rule and the sample positions every script shares; the page
(`src/data/memoriesOfGreen.js`) keeps the same rule. `glide_track.py` was the first try at the
glides, as one buzzy tone, and failed (see the journey).
