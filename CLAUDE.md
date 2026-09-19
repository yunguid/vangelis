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
│   ├── Sidebar/               # Collapsible sidebar panel
│   │   ├── index.jsx          # Sidebar container with icon rail
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
│   ├── midiLibraryPrefs.js    # Liked and removed MIDI files (localStorage)
│   ├── soundCatalog.js        # Every loadable sound in browsing order (acoustic, waveforms, banks, user)
│   ├── audioParams.js         # Audio parameter definitions and sanitization
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
- A piece that brings its own sound (a landing piece, a performance chosen in
  the MIDI library) puts it on the dial and under the keys, so the dial shows
  what is playing and playing along continues in that voice. The dial stays the
  listener's: turn it to another sound and the piece carries on, revoiced
  through that sound (`revoice` in `useMidiPlayback` sets aside the recording,
  patch and room a note brings and keeps its pitch, time and touch); turn back
  to the piece's own sound and it plays its own recordings again. Only a played
  note takes the keys over from a landing piece. Playing a piece again leaves
  the dial where the listener put it; a sound saved from a Sound tab keeps its
  instrument

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
- The home page chooses sounds on the dial alone: its sidebar is the MIDI
  browser (`<Sidebar soundPanel={false}>`). The editor, Design and Studies
  pages have no dial, so their sidebars keep the Sound tab, which shapes the
  sound and keeps a save row (`PresetShelf` with `saveOnly`); saved sounds
  persist in localStorage, join the dial as "Your sounds" and can be removed
  there. The full `PresetShelf` browser remains on the Design page
- The Design (`#/sound-designer`) and Studies (`#/studies`) pages are routable
  but deliberately not linked from the sidebar rail; Design is kept for
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
  are in the queue (localStorage), and all off means a silent landing
- Play MIDI through the synth with full sound engine
- Liked pieces lead the MIDI library under "Favorites", and a piece can be
  removed from it (and restored from the line under the list); both live as
  ids in localStorage (`utils/midiLibraryPrefs.js`), and a removed piece no
  longer opens the page either
- "Performances" bring their own sampled instrument and put it on the dial
  (see Sampled Instruments for playing them through another sound):
  `Saudade de Triana`, an original bossa/flamenco piece for nylon
  guitar written string-and-fret by `scripts/generate_guitar_performance.mjs`
  (MIDI channel = string) and played from per-string recordings arranged by
  `src/data/nylonGuitar.js` (samples built by `scripts/build_nylon_guitar.mjs`,
  attribution in `public/samples/nylon-guitar/README.md`). Sampled notes are
  started on the audio clock, so strums keep their string-to-string spacing
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
- Selection-first pattern editor (Ableton/Logic grammar): double-click
  adds a note, click selects, drag on empty space marquee-selects, drag
  moves the whole selection, right edge resizes, Delete/Backspace removes
  the selection, Cmd/Ctrl+A selects all, Esc deselects; right-click (or
  right-drag sweep) erases, Space toggles playback; Record loop captures one
  audio pass of the active loop as WAV
- Pure pattern model in `utils/pianoRollPattern.js` (beats domain, 4/4;
  `patternToMidiData` converts to the seconds-domain shape
  `useMidiPlayback` consumes); patterns persist via
  `utils/patternStorage.js` (localStorage)
- Loop transport through the current patch (`useMidiPlayback`
  `{ loop: true }`), selectable 1/2/4/8 bars, BPM 40-240, snap
  1/4-1/32 incl. triplets, optional key/scale row highlighting
- Track column down the right edge of the grid (Ableton's arrangement
  headers): one fixed-height deck per layer with an activator carrying the
  layer number (lit = on, click mutes), the name (click to edit that layer,
  double-click to rename in place), solo and the layer's sound. The column is
  a fixed width and scrolls on its own, so the grid never moves; on a phone the
  decks run as a strip above the grid
- Instrument layers, one neon colour each (`TRACK_COLORS`): solid notes are
  the layer being edited, outlined notes belong to other layers; clicking any
  note (or pressing 1-9) switches to its layer. Selection actions (chord
  builder, loop bars, snap to key) float over the grid so the grid never moves
- Notes-first look: 20px rows and a 96px beat at 100% zoom, so a sixteenth is
  24px; notes are solid rounded boxes in their track colour and carry their
  name whenever it fits (`noteNameFits`). The canvas draws one ground colour,
  lightly shaded black-key rows, octave lines, bar and beat lines; subdivision
  lines fade in with zoom. The key column is dark (a pressed key lights in the
  active track's colour), tempo/bars/snap/scale sit inline in the top bar, and
  the grid opens centred on the pattern's notes. Neon is for tracks and notes,
  orange for transport, everything else monochrome
- Metronome: the four beat cells beside BPM are its switch and its face.
  `addMetronomeClicks` (utils/pianoRollPattern.js) adds one dry square click per
  beat, accented on real downbeats even when a loop starts mid-bar, to the data
  handed to the transport, so clicks loop and follow tempo with the notes. The
  recording path and "Send to player" never get clicks; the setting is saved in
  the editor draft. The lit cell runs on `startVisibilityAwareRafLoop`, never
  raw `requestAnimationFrame` (`perf:site` caps explicit rAF sites at 12)
- A track's numbered colour square is its on/off switch: under the pointer or
  keyboard focus the number gives way to a power mark and a bright frame; solo
  brightens on hover and fills with the track colour when on
- Track cards are one row (number, name, sound chevron, solo); only the active
  track opens a second row naming its sound. In the phone strip every card
  keeps the fixed two-row height so a track switch cannot move the grid
- `LayerSoundBrowser` is lazy-loaded from the editor and must not import
  `utils/pianoRollPattern.js`: that module lives in the editor page's chunk, and
  an import back into it re-keys the page in the build manifest, which breaks
  `perf:site`'s route closure guard (the editor route is 38.5 KB of a 40 KB budget)
- Canvas grid + DOM note layer; "Open in player" hands the pattern to the
  home player via `utils/pendingMidiHandoff.js`

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

- When the task is done and `npx vitest run`, `npx vite build` and
  `npm run -s audit:ui` pass, commit on the session's `claude/<topic>` branch,
  fetch and rebase onto `origin/main` (re-run the gates if main moved), push
  the branch and open a PR whose body is the task summary: what was verified
  and how, what was assumed, what was left open.
- Push over SSH. Open the PR with a token passed to that one command
  (`GH_TOKEN=… gh pr create`), never through `gh`'s saved login or `gh auth`;
  without a token, hand over
  `https://github.com/yunguid/vangelis/compare/main...<branch>?expand=1`.
- A task that says "push to main" or "ship it" means: fast-forward `main`
  after a fresh fetch and rebase. Never force-push, and never merge a PR or
  enable auto-merge unless the task says so.
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
