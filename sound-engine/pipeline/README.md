# MIDI Pipeline

This pipeline turns a song search or source URL into a merged MIDI arrangement using:

- `yt-dlp` for download
- `Demucs` for stem separation
- `basic-pitch` for bass, vocals, and melody transcription
- `pretty_midi` to merge the resulting stem MIDI files

## Bootstrap

```bash
cd /Users/luke/cursor-projs/vangelis/sound-engine
./pipeline/bootstrap.sh
```

## Run the backend

```bash
cd /Users/luke/cursor-projs/vangelis/sound-engine/backend
cargo run
```

## Job outputs

Generated jobs are written to:

`/Users/luke/cursor-projs/vangelis/sound-engine/generated/pipeline-jobs/<job-id>/`

Each completed job includes:

- `artifacts/full-arrangement.mid`
- `midi/bass.mid`
- `midi/vocals.mid`
- `midi/other.mid`

Only process audio you have rights to use.
