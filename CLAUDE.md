# Vangelis - Web MIDI Synthesizer

A browser-based synthesizer with real-time sound generation, custom sample support, MIDI playback, and recording capabilities.

## Project Vision

Vangelis is an expressive, playable web synthesizer that feels responsive and musical. The core goals are:

1. **Real-time synthesis** - Notes respond instantly with proper ADSR envelopes controlled by key press and release
2. **Custom sounds** - Upload audio samples or import entire sample libraries to play via the keyboard
3. **MIDI playback** - Load and play MIDI files through the synth with visual keyboard feedback
4. **Recording** - Capture performances and auto-download as WAV files

## Architecture

The repo is a single Vite + React app at the root (`src/`, `public/`, `scripts/`,
`golden/`, `docs/`).

- **DSP core** - Pure-JS AudioWorklet processors in `src/audio/` (synth, delay,
  reverb, recorder) running on the audio thread. The synth worklet is a thin shell over
  pure-DSP ES modules in `src/audio/dsp/` (oscillator, envelope, LFO, SVF,
  voice, mod-routes, DC blocker), each unit-tested directly. There is no Rust/WASM in
  the audio path; a worst-case polyphonic benchmark
  (`scripts/bench_synth_worklet.mjs`) showed ample realtime headroom in plain
  JS, so the DSP stays in hot-reloadable JS.
- **Audio quality gates** - `npm run audit:audio` renders every factory preset (and the
  delay/reverb worklets) against golden masters in `golden/` — stereo
  per-channel fingerprints, aliasing, DC, heap-drift metrics. See `docs/ENGINE_DESCENT.md`
  and `docs/ENGINE_LEDGER.md` for the improvement loop and its history.

### Audio Pipeline
```
AudioWorklet synth (4-pt polyBLEP/BLAMP + FM + ADSR + SVF + LFO
                    + stereo unison spread + DC blocker + soft-clip knee)
    -> Input bus
    -> Compressor
    -> Distortion
    -> Delay (with feedback)
    -> Reverb (algorithmic FDN worklet)
    -> Master Gain
    -> Stereo Panner
    -> Analyser (visualization)
    -> Destination / MediaRecorder

Custom Sample playback:
AudioBufferSource (pitch-shifted sample)
    -> GainNode (per-voice ADSR envelope)
    -> Input bus (shared FX chain)
```

## Frontend Structure

```
src/
├── App.jsx                    # Main app component, state management
├── style.css                  # Global styles
│
├── components/
│   ├── AudioControls.jsx      # ADSR, effects, filter, and mod-matrix controls
│   ├── ErrorBoundary.jsx      # React error boundary
│   ├── PresetShelf.jsx        # Preset browser (Design page) and the Sound tab's save row
│   ├── SoundDial.jsx          # The sound selector: a wide dial docked to the bottom edge
│   ├── Scene.jsx              # Audio-reactive WebGL2 shader background
│   ├── UIOverlay.jsx          # Waveform selector overlay
│   ├── WaveCandy*.jsx         # Perceptual visualizer suite (Canvas 2D)
│   ├── controls/
│   │   └── ValueSlider.jsx    # Accessible slider primitive (ARIA, drag, keys, wheel)
│   │
│   ├── editor/                # Piano-roll editor parts (#/editor)
│   │   ├── VelocityLane.jsx   # Velocity stems under the grid
│   │   ├── ProjectBrowser.jsx # Projects list (lazy)
│   │   ├── AccountPanel.jsx   # Owner sign-in (lazy; only with Supabase env)
│   │   └── editorIcons.jsx    # Tool and bar icons
│   │
│   ├── Sidebar/               # The dock and its slide-out panels
│   │   ├── index.jsx          # Sidebar container (panels, Escape, backdrop)
│   │   ├── SidebarRail.jsx    # The auto-hiding wave dock (icon-only controls)
│   │   ├── DockWave.jsx       # The dock's wave, rim and rivets (lazy, desktop only)
│   │   ├── waveDockPath.js    # The wave's outline math
│   │   ├── Sidebar.css        # Sidebar styles
│   │   ├── MidiTab.jsx        # MIDI file browser
│   │   └── MidiPlayer.jsx     # MIDI playback controls
│   │
│   └── SynthKeyboard/         # Virtual piano keyboard
│       ├── index.jsx          # Keyboard container
│       ├── components/Key.jsx # Individual key component
│       └── hooks/             # Keyboard-specific hooks
│
├── context/
│   └── SynthContexts.jsx      # SoundControls / MidiTransport contexts
│
├── hooks/
│   ├── useMidiPlayback.js     # MIDI scheduling and playback engine
│   └── useWebMidiInput.js     # Hardware MIDI in (notes, pitch bend, mod wheel)
│
├── utils/
│   ├── math.js                # Shared math utilities (clamp, MIDI helpers)
│   ├── midiParser.js          # Parse .mid files using @tonejs/midi
│   ├── factoryPresets.js      # Deferred 45-patch factory bank
│   ├── userPresetStorage.js   # localStorage-backed user presets (+ change subscription)
│   ├── soundCatalog.js        # Every loadable sound in browsing order (acoustic, waveforms, banks, user)
│   ├── audioParams.js         # Audio parameter definitions and sanitization
│   ├── pianoRollPattern.js    # Editor pattern model and note transforms (pure)
│   ├── projectLibrary.js      # Editor projects on this device (autosaved)
│   ├── cloudPatternStore.js   # Owner account: sign-in, project rows, .mid files
│   ├── midiExport.js          # Pattern -> Standard MIDI File (lazy)
│   │
│   └── audioEngine/           # Core audio engine modules
│       ├── constants.js       # Audio constants (sample rate, pool sizes)
│       ├── graph.js           # Web Audio graph creation
│       ├── samplePool.js      # Voice pool for sample playback
│       └── recorder.js        # Recording and WAV export
│
└── audio/
    ├── synth-worklet.js       # AudioWorklet shell (message protocol, voice pool, master clip)
    ├── dsp/                   # Pure-DSP modules (oscillator, envelope, lfo, svf,
    │                          #   voice, mod-routes, dc-blocker) + direct unit tests
    ├── delay-worklet.js       # Tempo-synced feedback delay (contractive feedback loop)
    ├── reverb-worklet.js      # Algorithmic FDN reverb
    └── recorder-worklet.js    # PCM capture for WAV export
```

## Key Features

### Sidebar dock
- On desktop the sidebar is a dock that hides at the left edge: at rest only a
  3 x 40px brass notch shows. A 10px strip down the edge brings it out; it
  stays while the pointer is over it, keyboard focus is in it or a panel is
  open, and goes 320ms after the pointer leaves. Escape puts it away. With no
  hover (tablets), a tap on the notch toggles it
- It is a wave, not a rectangle: a flat-topped bell out of the wall
  (`waveDockPath.js`, 120 x 440, reach 74) with a brass rim, an engraved line
  and four rivets; the rim swells under the pointer (the path is set on the
  node, no render per move, never an rAF loop) and the current page gets a
  brass gauge needle. It grows out with a slight overshoot; reduced motion
  fades instead
- Icon-only controls (sound knob, 5-pin MIDI socket, keys, piano roll) are CSS
  masks in `Sidebar.css`, named by aria-label with a title; brass marks the
  current page, the open panel and a playing MIDI file. `DockWave.jsx` loads
  at idle on desktop, never on a phone, to keep every route inside its JS
  budget. Panels open 86px from the edge. On phones the dock stays a bottom
  bar, icons only
- Pages no longer reserve the old 72px rail: the sound dial centres in the full
  width, the Design page's floor is 24px, and the editor keeps a 10px gutter
  for the hot strip

### Real-time Synthesis
- AudioWorklet-based polyphonic synth with PolyBLEP (saw/square) and PolyBLAMP (triangle) anti-aliasing
- Square pulse width (`squareDuty`, 5-95% duty, DC-compensated; 0.5 renders
  bit-exact with the old fixed square) for 12.5% / 25% handheld-chip pulse voices
- FM synthesis with adjustable modulation index and ratio
- ADSR envelopes for amplitude, plus a dedicated modulation envelope
- State-variable filter with resonance
- Modulation matrix: 7 sources (2 multi-shape LFOs incl. S&H, amp env, mod env,
  velocity, key track, mod wheel) → 5 destinations (pitch, cutoff, amp, FM index,
  detune), up to 8 routes with bipolar depth
- Glide/portamento, pitch bend and mod wheel messages, velocity curves
- Web MIDI hardware input (notes, bend wheel, CC1)
- Unison with configurable voice count and detune, spread equal-power across the stereo field

### Custom Sample Mode
- Upload WAV/MP3/OGG files as custom instruments
- Samples mapped across keyboard with pitch shifting
- Supports one-shot and looped playback
- Per-voice envelopes applied to samples

### Sampled Instruments
- `data/sampledInstruments.js`: the Grand Piano (the lullaby's Salamander
  recordings, a minor third apart) and the Nylon Guitar are sounds like any
  preset, in the dial's "Acoustic" band. Each carries its envelope and room as
  `audioParams` plus `instrument`, the recordings App decodes and hands to
  `audioEngine.setInstrument`; `playFrequency` then plays every key, hardware
  MIDI note and MIDI-file note from the recording nearest its pitch (never
  more than a semitone away from D2 to A#5 on the piano, E2 to B5 on the
  guitar). A note that brings its own voice (`voiced`: a piece's patch, an
  editor layer) stays with the synth, and the instrument leaves with the home
  page so the editor's layers keep their own sounds
- The playable guitar has its own takes (`public/samples/nylon-guitar/keys`,
  built by `scripts/build_nylon_guitar.mjs --keys`): one fretted position per
  whole tone, mf and ff, each left to ring out, on the same level line as the
  piece's takes (which are cut to its note lengths). A key struck hard plays
  the forte take; a position plucked again within 1.5 s plays the other one
- A landing piece loads its own sound under the keys (`useOpeningPerformance`
  reports it as `sound`), so the dial shows what is playing and playing along
  continues in that voice; a sound saved from the Sound tab keeps its instrument

### Factory Preset Bank
- 45 hand-designed patches in `utils/factoryPresets.js`, grouped by category
  (Leads / Pads & Strings / Bass / Keys & Bells / Motion & Texture), built on
  the CS-80 / Blade Runner palette, classic rare synths (Prophet-5, Jupiter-8,
  Oberheim, PPG, Fairlight, Juno-106, ARP 2600, Memorymoog) and modern
  hyperpop / trap / rage production sounds
- Patch Lab: 16 additional original patches in `utils/patchLabPresets.js`
  (Cinema Analog / Orchestral Pop / Beat Lab / Experimental / Handheld), technique
  studies authored against the same CLEAN_PATCH slate and test contract;
  loads with the factory bank in one deferred step
- Every factory patch spreads over a fully-specified clean slate so preset
  switching is deterministic (nothing leaks from the previous sound)
- Sounds are chosen on the `SoundDial`, a wide dial docked to the bottom of the
  home page (the top of a wheel whose hub lies below the page): every sound in
  `utils/soundCatalog.js` is a tick under a fixed needle, grouped into category
  bands. Drag, scroll, arrow keys, the steppers or a click on the ring turn it;
  `/` opens it and typing finds sounds by name, category or description.
  Resting on a sound loads it, and the loaded sound persists in the session
- The "Blade Runner" band (`data/bladeRunnerSounds.js`, after Acoustic) holds
  the replica's sounds for the keys, built from its own patches: CS-80 Blues,
  Blues Pad, Offworld Drone and Blade Runner Boom. The CS-80 and the pad are
  sounds in layers: a catalog entry with `layers` ([{ waveformType, gain,
  audioParams }]) plays every key that brings no voice of its own on the
  engine's key layers (`audioEngine.setKeyLayers`, a part the score's
  `clearParts` leaves alone), all layers started on one sample 10 ms ahead
  (skewed, the sine and the saw's fundamental cancel in part); pitch bend and
  the mod wheel reach them too. Its `audioParams` is what the Sound tab shows
  and sets the room; an edit there (a setting that differs from the sound's
  own) reaches every layer. The layers persist in the session and in saved
  sounds; choosing a waveform leaves them
- The sidebar's Sound tab shapes the sound and keeps a save row (`PresetShelf`
  with `saveOnly`); saved sounds persist in localStorage, join the dial as
  "Your sounds" and can be removed there. The full `PresetShelf` browser
  remains on the Design page
- The Design (`#/sound-designer`) and Studies (`#/studies`) pages are routable
  but deliberately not linked from the sidebar dock; Design is kept for
  background sound design
- `factoryPresets.test.js` pins all patches to legal engine ranges

### MIDI Playback
- Load .mid files (built-in library or upload)
- "Originals" corpus: 59 in-house cues composed from scratch for the synth
  presets (beautiful synth, hyperpop, trap, rage, acid, synthwave, ambient…),
  generated by `scripts/generate_original_midis.mjs` into
  `public/midi/originals/` (re-run the script after editing compositions)
- Landing queue (`data/landingQueue.js`): on page load the keyboard plays one
  piece picked at random from `LANDING_PIECES` (never the previous visit's
  while there is a choice); "On load" switches in the MIDI tab choose which
  are in the queue (localStorage), and all off means a silent landing. The
  queue is Luke's choice: Pernambuco, The Shade of the Mango Tree, Subwoofer
  Lullaby and Blade Runner Blues; a performance with `landing: false`
  (Saudade de Triana) stays in the library only
- A built-in piece can be removed from the MIDI tab (the × on a row, then
  Remove in the row's confirmation). Removed ids live in localStorage
  (`vangelis.midiRemoved.v1`); a removed piece leaves the list, its search and
  the landing queue until "N removed · Restore" under the list brings all back
- Play MIDI through the synth with full sound engine
- "Performances" bring their own sampled instrument instead of the loaded
  preset: `Saudade de Triana`, an original bossa/flamenco piece for nylon
  guitar written string-and-fret by `scripts/generate_guitar_performance.mjs`
  (MIDI channel = string) and played from per-string recordings arranged by
  `src/data/nylonGuitar.js` (samples built by `scripts/build_nylon_guitar.mjs`,
  attribution in `public/samples/nylon-guitar/README.md`). Sampled notes are
  started on the audio clock, so strums keep their string-to-string spacing
- `Pernambuco` (Luiz Bonfá, *Solo in Rio 1959*) is a note-by-note transcription
  of the record, not the record: `src/data/guitarTranscriptions.js` reads its MIDI file
  (channel = string; velocity = loudness; CC 70 = which recorded stroke, CC 74 =
  brightness, CC 75 = how fast a muted stroke dies; RPN 1 = the record's pitch,
  +41.7 cents) and plays each note from the Iowa take of that string, fret and
  stroke in `public/samples/nylon-guitar/pernambuco`, voiced like the record.
  `SampleVoice` applies a stroke's `brightness` (a high shelf at 3x the note),
  `mute` (a decay on the audio clock) and a set's `gain`. The record's recording
  chain comes along: a mono room fitted by rendering against the record, and its
  tape hiss as looping white noise 44 dB under the music
- `The Shade of the Mango Tree` (Luiz Bonfá with Don Burrows and George Golla,
  *Bonfa Burrows Brazil*, 1978; the record Nujabes sampled for "Lady Brown") is
  the same kind of transcription of a band record's guitar alone: Demucs lifts
  the guitar out of the band (`scripts/guitar-transcription/separate.py`,
  eight seeded offsets), and the flute, bass, drums and strings are not
  played. Its voice (`GUITAR_TRANSCRIPTIONS` in `guitarTranscriptions.js`,
  takes in `public/samples/nylon-guitar/shade-of-the-mango-tree`, RPN 1 =
  +7.5 cents) was set against the record's first 20 seconds, where the guitar
  plays alone: an ambient room chosen by how it fills the intro's pauses, the
  hiss 48.7 dB under the music, and each take's pluck voiced apart from its
  ring (`build_samples.py --attack`), since the Iowa player's attack is far
  brighter than Bonfá's on this record. Journey:
  `docs/replicas/shade-of-the-mango-tree/JOURNEY.md`
- `Blade Runner Blues` (Vangelis, 1982; the 1994 album) is a transcription played
  by the app's own synth (`src/data/bladeRunnerBlues.js`): four parts, a CS-80
  (a sine layer, louder up the keyboard, beside a phase-aligned saw low-passed at
  9.5 kHz), a pad (a sine beside a half-cycle-shifted saw low-passed at 5 kHz),
  the bass (the record's "booms": struck FM sines), a low bed of held sines on a
  0.591 Hz grid at 30-57 Hz, and synthesized floor noise as its ambience (fading
  in over 3 s and out over the last 4.2 s), all in one ambient room. Its MIDI
  file is MPE-style, a voice track per sounding note: pitch bend (RPN 0 sets the
  range; @tonejs/midi reads bends as -1..1) is the note's pitch in cents from
  A440 with its scoop and vibrato, CC 11 its loudness ((v - 127) / 2 dB); channels
  1-12 CS-80, 13-14 pad, 15 low bed, 16 bass. `scripts/synth-transcription/` made
  it from the record; `docs/replicas/blade-runner-blues/JOURNEY.md` logs the
  journey. In the landing queue since v1 (the keys keep the listener's sound)
- A score may carry an `ambience` bed ({ buffer, gain, audioParamOverrides,
  fadeIn, fadeOut }): `useMidiPlayback` loops it under the notes whenever they
  sound (play, resume, seek, tempo change) and stops it with them; it never
  lights a key. It holds at its own level, never the player's decay and sustain
  (the envelope reaches that voice alone, not the keys' synth), rising over
  `fadeIn` seconds (else its attack); with `fadeOut` it falls linearly to
  silence by the score's end, scheduled on the audio clock when it starts
- A score may carry synth `parts` ({ name: { layers: [{ params, waveformType,
  gain }] } }): every layer is a synth worklet node of its own
  (`audioEngine.setParts`), so several patches sound at once through the shared
  effects chain (a CS-80's two channels are two layers). A note with `part`
  plays there on the audio clock (`when`), with optional per-note `expression`
  curves ({ rate, pitch in cents, gain, cutoff in octaves }: the CS-80's scoop
  into each note, its pressure and brilliance) that the voice reads per sample
  and holds at their last value; its `audioParamOverrides` set the effects
  chain, as a sampled note's do. Without `when`/`expr` the synth renders
  bit-exact to before (`audit:audio`). `stopNote(id, when)` releases a part's
  note on the clock; `clearParts` retires the nodes once their tails ring out
- `node scripts/render_performance.mjs --piece <landing id> --out x.wav` renders
  a sampled performance offline the way the page plays it (voices, master chain
  and the real reverb worklet), for comparing against a source recording;
  `--peaks file.json` also writes the render's waveform (480 peak/RMS pairs),
  `--params '{...}'` tries other settings, `--ambience off` drops the bed;
  `--score <module.mjs>` (exporting `async loadScore(root)`) renders a score in
  development, and scores with `parts` run the real synth worklet per layer.
  `scripts/guitar-transcription/` (Python) is the pipeline that made Pernambuco
  and The Shade of the Mango Tree
- A performance with a `waveform` file (`LANDING_PIECES`) shows it as a still
  picture at the top of the open sound dial while its instrument is the loaded
  sound; the dial takes it when it opens and keeps it until it closes
- Under the visual row a "Notes" disclosure (`showNotes`, saved in the
  session) slides the keyboard down over 500 ms and opens `BirdsEyeRadar`, the
  falling notes of whatever is playing (the MIDI tab's piece, else the landing
  piece), between the visualizers and the keys. Playing a piece from the MIDI
  tab opens it; the canvas unmounts once the panel has slid shut
- Visual feedback on keyboard shows active notes
- Play/pause/stop controls with progress bar

### Classical Learning Catalog
- `src/data/classicalCatalog.json` (schema v1): hash-verified classical
  works with full musicological metadata (composer, catalogue numbers,
  key, genre, period, duration) and per-file provenance (source URL,
  encoder, license + license URL, attribution, sha256, retrieval date)
- Featured flagship: Schubert — Impromptu in G-flat major, Op. 90 No. 3
  (D.899), first on `#/studies` and its MIDI idle-prefetched there
- Sources: piano-midi.de (Bernd Krueger, CC BY-SA 3.0 DE, via pinned
  Internet Archive snapshots) and the Mutopia Project (per-piece PD/CC)
- `npm run sync:midis` → `scripts/sync_classical_midis.mjs`: allowlisted,
  throttled, resumable importer; verifies sha256 on every entry; `--pin`
  prints hashes for new entries (never auto-writes the manifest);
  `--dry-run` / `--verify` modes; prints a license/audit table
- Gates: `classicalCatalog.test.js` (schema, hashes on disk, provenance
  completeness, featured rank) and a perf-budget line (D00b ≤ 384 KiB +
  manifest↔directory bijection guard). History: `docs/CATALOG_LEDGER.md`

### Piano Roll (`#/editor`)
- Look: poured concrete (Ableton-dark, brutalist). Flat warm-grey slabs, joints
  cut darker, 1-2px corners, hard offset shadows instead of blurred ones; the
  tokens (`--slab-*`, `--bone`, `--signal`, `--oxide`, `--brass`) live on
  `.piano-roll-page` in `PianoRollPage.css`, so the look is the editor's alone.
  Colour has three jobs: tracks and notes (`TRACK_COLORS`, enamel paints; old
  neon and muted palettes map onto them by slot), time (signal orange: play,
  metronome, loop brace, playhead) and the record light (oxide)
- Layout: a transport bar (Projects, name, save status, New · play, record,
  BPM, metronome, bars · menu, account) over a tool bar (tools, grid, scale,
  Transform, velocity lane, zoom, shortcuts); a real piano-key column; the grid
  (alternating bar shading, a joint under every row); the velocity lane pinned
  under the grid in the same scroller; the track column on the right. A 10px
  left gutter is the dock's hot strip
- Tools (FL Studio's set on Ableton-friendly keys): Select `V` (click, drag to
  move, either edge resizes the selection, ⌥-drag copies, double-click adds or
  removes), Draw `B` (press adds a note at the last length, drag right sets its
  length; B again returns to Select), Paint `P` (one note per grid step along
  the drag, pitch follows the pointer, ⇧ holds it), Slice `C` (cuts at the
  nearest grid line; drag down to cut a stack), Erase `E` (click or sweep).
  ⌘ while dragging ignores the grid; right-drag erases in every tool
- Velocity: notes are as opaque as they are loud (`velocityFill`); the lane
  (`components/editor/VelocityLane.jsx`) drags a stem (the whole selection
  moves with it) or draws a line across stems. `0` mutes (deactivates) the
  selected notes: they stay drawn, dashed, and `patternToMidiData` skips them
- Transform menu (Ableton's rule: the selection, or the whole track when
  nothing is selected): Quantize ⌘U, Legato, Reverse, Invert, Stretch ×2,
  Squeeze ÷2; pure functions in `utils/pianoRollPattern.js` with tests
- Projects: every edit autosaves (400 ms) to the draft (`utils/patternDraft.js`,
  the open project and its view) and to the device's project list
  (`utils/projectLibrary.js`, which adopted the old `vangelis.patterns.v1`
  saved patterns once). New starts a blank project at once; the Projects
  browser (lazy `components/editor/ProjectBrowser.jsx`) opens, duplicates and
  deletes. ⌘S or the status text saves now. There is no unsaved-changes prompt
- Account (dormant until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are
  set; without them nothing about an account renders): one owner, password
  sign-in (lazy `components/editor/AccountPanel.jsx`), sign-ups disabled in
  `supabase/config.toml`. Signed in, unsynced projects go to the `patterns`
  table and each one's `.mid` (`utils/midiExport.js`, @tonejs/midi) to the
  private `midi` bucket at `<user id>/<row id>.mid`
  (`supabase/migrations/20260925000000_midi_files.sql`). Whether to keep this
  on Supabase is Luke's open decision: never provision or connect it yourself,
  and never through the Quikirr-org Supabase connector
- Loop transport through each track's sound (`useMidiPlayback`
  `{ loop: true }`), BPM 40-240, snap 1/4-1/32 incl. triplets, optional
  key/scale row highlighting; the timeline grows in 4-bar chunks as it scrolls
- Track column down the right edge of the grid (Ableton's arrangement
  headers): one deck per layer with its colour down the left edge, an
  activator carrying the layer number (lit = on, click mutes; under the
  pointer it shows a power mark), the name (click to edit that layer,
  double-click to rename in place), solo and the layer's sound. Only the
  active track opens a second row naming its sound. The column is a fixed
  width and scrolls on its own, so the grid never moves; on a phone the decks
  run as a strip above the grid, every card the same height
- Solid notes are the layer being edited, outlined notes belong to other
  layers; clicking any note (or pressing 1-9) switches to its layer. Selection
  actions (chord builder, loop bars, snap to key) float over the grid so the
  grid never moves
- Metronome: the four beat cells beside BPM are its switch and its face.
  `addMetronomeClicks` (utils/pianoRollPattern.js) adds one dry square click per
  beat, accented on real downbeats even when a loop starts mid-bar, to the data
  handed to the transport, so clicks loop and follow tempo with the notes. The
  recording path and "Send to player" never get clicks; the setting is saved in
  the editor draft. The lit cell runs on `startVisibilityAwareRafLoop`, never
  raw `requestAnimationFrame` (`perf:site` caps explicit rAF sites at 12)
- Lazy pieces (`LayerSoundBrowser`, `ProjectBrowser`, `AccountPanel`,
  `midiExport`) must not import any module that lives in the editor page's
  chunk (`utils/pianoRollPattern.js`, `components/editor/editorIcons.jsx`, ...):
  an import back into it re-keys the page in the build manifest, which breaks
  `perf:site`'s route closure guard. The editor route measured 44.98 KB gzip
  against the 40 KB D12 budget after the concrete rework (was 39.0)
- Canvas grid + DOM note layer; "Send to player" hands the pattern to the
  home player via `utils/pendingMidiHandoff.js`; "Export MIDI file" downloads it

### Recording
- Record button captures all audio output
- Uses an AudioWorklet (`recorder-worklet.js`) to capture raw PCM on the audio thread
- Exports as WAV format with automatic download

### Effects Chain
- **Compressor** - Dynamics control
- **Distortion** - Soft clipping with adjustable drive
- **Delay** - Tempo-synced with feedback
- **Reverb** - Algorithmic FDN worklet (room/plate/hall/ambient variants)

## Development

```bash
npm install
npm run dev
```

Benchmark the synth worklet's DSP hot loop:
```bash
node scripts/bench_synth_worklet.mjs
```

## Shipping

Standing permission for agent sessions. `main` is unprotected, has no CI and
deploys to production on every push (Vercel and GitHub Pages); a pushed branch
gets a Vercel preview.

- This project always ships to `main` (Luke, 2026-09-25: "for this project we
  always push to main"). When the task is done and `npx vitest run`,
  `npx vite build` and `npm run -s audit:ui` pass, commit on the session's
  branch, fetch and rebase onto `origin/main` (re-run the gates if main
  moved), then fast-forward it: `git push origin HEAD:main`. The commit
  message carries the task summary: what was verified and how, what was
  assumed, what was left open.
- Push over SSH. Never force-push; if `main` moved, fetch, rebase and re-run
  the gates again rather than pushing over it. Never use `gh`'s saved login
  or `gh auth`.
- A branch and PR only when the task asks for one (hand over
  `https://github.com/yunguid/vangelis/compare/main...<branch>?expand=1`).
- A task that says "do not push" overrides this section.

## Keyboard Controls

| Key | Action |
|-----|--------|
| A-; | White keys (C to F) |
| W-P | Black keys (sharps) |
| Z/X | Octave down/up |
| C/V | Velocity down/up |
| Space | Toggle recording |
| ? | Show shortcuts overlay |
| Esc | Close overlays |

Typed keys carry no velocity of their own: they play at the key velocity
(Soft 0.55 / Med 0.85 / Hard 1), which C/V step and the touch bar's
Soft/Med/Hard picks; touches that report no pressure use it too. Striking the
same key again within 250 ms adds an accent of up to +0.15, and coming back to
a key never makes it quieter (`SynthKeyboard/hooks/useKeyboardInput.js`).

## Dependencies

### Core
- React 18 API (aliased to Preact via `preact/compat` in production builds; real React in tests)
- Vite (build tool)

### Audio
- @tonejs/midi (MIDI parsing)
- Web Audio API (AudioWorklet, ConvolverNode, etc.)
