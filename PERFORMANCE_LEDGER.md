# Vangelis performance ledger

This is the measurement contract for the site-wide performance program. A change is an
optimization only when it improves a measured metric, preserves the audio-quality gates,
and does not move another user-facing metric outside its budget.

## Routes in scope

`#/`, `#/sound-designer`, `#/control-kit`, `#/voice-loop`, `#/midi-pipeline`,
`#/study-songs`, built-in `#/study/:slug`, and generated `#/study/generated/:jobId`.

## Collection protocol

- **BUILD**: production Vite build analyzed by `npm run perf:site`.
- **BROWSER**: Chromium Performance APIs/DevTools, cold and warm, median of five runs.
- **REACT**: React Profiler commit counts/durations during scripted interactions.
- **VISUAL**: deterministic canvas/radar workload plus live frame sampling.
- **AUDIO**: worklet benchmark and golden-master audit.
- **STATIC**: source census for loops, listeners, timers, route imports, and assets.
- Cold runs use an empty HTTP cache and fresh document. Warm runs reuse immutable assets.
- CPU-sensitive metrics record machine, browser, viewport, DPR, power mode, and throttling.

## Metric catalog (88 metrics)

| ID | Metric | Budget / target | Method |
|---|---|---|---|
| D01 | Initial HTML raw bytes | <= 5 KB | BUILD |
| D02 | Initial HTML gzip bytes | <= 2 KB | BUILD |
| D03 | Initial-route JS raw bytes | <= 350 KB | BUILD |
| D04 | Initial-route JS gzip bytes | <= 110 KB | BUILD |
| D05 | Initial-route CSS raw bytes | <= 130 KB | BUILD |
| D06 | Initial-route CSS gzip bytes | <= 25 KB | BUILD |
| D07 | Largest eager JS chunk gzip | <= 55 KB | BUILD |
| D08 | Secondary-route code in initial graph | 0 route modules | BUILD/STATIC |
| D09 | Route chunk count | >= 1 per secondary route | BUILD |
| D10 | Duplicate module bytes | 0 material duplicates | BUILD |
| D11 | Unused dependency bytes | decreasing; remove dead packages | BUILD/STATIC |
| D12 | Production build duration | <= baseline + 10% | BUILD |
| D13 | Transformed module count | explain increases > 5% | BUILD |
| D14 | Worklet aggregate raw bytes | <= baseline + 5% | BUILD |
| D15 | Public eager asset bytes | only requested assets transfer | BROWSER |
| N01 | Document TTFB | <= 200 ms local / <= 800 ms p75 prod | BROWSER |
| N02 | DOMContentLoaded | <= 1,000 ms local cold | BROWSER |
| N03 | Window load | <= 1,500 ms local cold | BROWSER |
| N04 | First Contentful Paint | <= 1,000 ms local cold | BROWSER |
| N05 | Largest Contentful Paint | <= 2,500 ms p75 | BROWSER |
| N06 | Cumulative Layout Shift | <= 0.05 | BROWSER |
| N07 | Interaction to Next Paint | <= 200 ms p75 | BROWSER |
| N08 | Total Blocking Time | <= 150 ms local profile | BROWSER |
| N09 | Speed Index | <= 2,000 ms local cold | BROWSER |
| N10 | Time to interactive controls | <= 1,500 ms local cold | BROWSER |
| N11 | Route transition to first paint | <= 250 ms warm | BROWSER |
| N12 | Route transition to interactive | <= 500 ms warm | BROWSER |
| N13 | Cold request count | no accidental fan-out; decreasing | BROWSER |
| N14 | Cold transferred bytes | decreasing per route | BROWSER |
| N15 | Warm transferred bytes | <= 20% of cold | BROWSER |
| M01 | Long-task count during load | 0 tasks > 50 ms | BROWSER |
| M02 | Worst long task | <= 50 ms | BROWSER |
| M03 | Main-thread scripting time | decreasing per route | BROWSER |
| M04 | Main-thread style/layout time | decreasing per route | BROWSER |
| M05 | Main-thread paint/composite time | decreasing per route | BROWSER |
| M06 | JS parse/compile time | decreasing with route split | BROWSER |
| M07 | DOM node count | <= 1,500 per route closed-state | BROWSER |
| M08 | Maximum DOM depth | <= 32 | BROWSER |
| M09 | Event-listener count after mount | stable across remounts | BROWSER |
| M10 | Timer count after mount | only intentional active timers | BROWSER |
| M11 | RAF callback families while visible | documented and bounded | STATIC/BROWSER |
| M12 | RAF work while hidden | 0 rendered frames | BROWSER |
| M13 | Forced layout count | 0 in steady-state interactions | BROWSER |
| M14 | Layout recalculation per slider drag | <= 1 per frame | BROWSER |
| R01 | Initial React commit count | <= 2 production commits | REACT |
| R02 | Initial React render duration | decreasing per route | REACT |
| R03 | Slider drag commit count | <= animation-frame count | REACT |
| R04 | Slider drag p95 commit duration | <= 8 ms | REACT |
| R05 | Note-on React commit duration | <= 8 ms | REACT |
| R06 | Sidebar open commit duration | <= 16 ms | REACT |
| R07 | MIDI list initial rendered rows | virtualize/cap if > 100 | REACT |
| R08 | Preset panel initial rendered rows | folded/capped off-route | REACT |
| R09 | Context fan-out renders | only consumers of changed state | REACT |
| R10 | Route remount duplicate subscriptions | 0 | REACT/STATIC |
| V01 | WaveCandy target FPS active | >= 24 FPS | VISUAL |
| V02 | WaveCandy idle FPS | <= 10 FPS or event-driven | VISUAL |
| V03 | WaveCandy hidden FPS | 0 drawn FPS | VISUAL |
| V04 | WaveCandy p95 frame CPU | <= 8 ms | VISUAL |
| V05 | WaveCandy analyser samples/sec | <= current justified budget | VISUAL |
| V06 | WaveCandy canvas backing pixels | DPR-capped, no oversizing | VISUAL |
| V07 | Radar target FPS playing | >= 20 FPS | VISUAL |
| V08 | Radar idle FPS with MIDI | <= 10 FPS | VISUAL |
| V09 | Radar empty FPS | <= 4 FPS or event-driven | VISUAL |
| V10 | Radar note evaluations/sec | bounded by visible window | VISUAL |
| V11 | Scene target FPS active | adaptive, <= display refresh | VISUAL |
| V12 | Scene hidden FPS | 0 drawn FPS | VISUAL |
| V13 | Scene backing pixels | DPR <= 1.25 | VISUAL |
| V14 | Visual workload CPU | no >5% regression | VISUAL |
| A01 | Worst-case DSP realtime headroom | >= 5.7x | AUDIO |
| A02 | DSP time per 128-frame block | <= 467 us baseline gate | AUDIO |
| A03 | Audio context creation time | <= 100 ms local | BROWSER/AUDIO |
| A04 | Worklet module load time | <= 250 ms cold local | BROWSER/AUDIO |
| A05 | First note request-to-schedule latency | <= 20 ms | BROWSER/AUDIO |
| A06 | Note-off request-to-schedule latency | <= 20 ms | BROWSER/AUDIO |
| A07 | Scheduler lookahead/timer lateness p95 | <= 10 ms | BROWSER/AUDIO |
| A08 | Active voice ceiling | bounded at configured max | AUDIO |
| A09 | Audio hot-loop allocations | 0 steady-state | AUDIO |
| A10 | Saturated heap drift | <= 2 MB / 4,000 blocks | AUDIO |
| A11 | Golden synth renders | 225/225 pass | AUDIO |
| A12 | Golden FX renders | 7/7 pass | AUDIO |
| A13 | Audible saw alias | <= -40 dB | AUDIO |
| A14 | Audible square alias | <= -40 dB | AUDIO |
| A15 | Audible triangle alias | <= -40 dB | AUDIO |
| A16 | Audible FM-sine alias | <= -40 dB | AUDIO |
| L01 | JS heap after cold mount | record per route | BROWSER |
| L02 | JS heap after 5 min idle | <= mount + 10% | BROWSER |
| L03 | JS heap after 5 min playing | bounded plateau | BROWSER |
| L04 | Heap after 20 route cycles | <= first cycle + 10% | BROWSER |
| L05 | Detached DOM nodes after route cycles | 0 material growth | BROWSER |
| L06 | Canvas/WebGL contexts after route cycles | returns to route baseline | BROWSER |
| L07 | Audio nodes after stop/reset cycles | returns to engine baseline | BROWSER |
| L08 | MIDI timeout handles after stop | 0 | BROWSER/TEST |
| I01 | Keyboard keydown handler time p95 | <= 8 ms | BROWSER |
| I02 | Pointer note-on handler time p95 | <= 8 ms | BROWSER |
| I03 | Slider input handler time p95 | <= 8 ms | BROWSER |
| I04 | Sidebar open response | <= 100 ms visual response | BROWSER |
| I05 | Preset apply response | <= 100 ms UI / <= 20 ms audio schedule | BROWSER |
| I06 | MIDI search response | <= 50 ms for current corpus | BROWSER |
| I07 | MIDI play startup | <= 150 ms cached file | BROWSER |
| I08 | Main-thread input delay under visuals | <= 50 ms p95 | BROWSER |
| I09 | Scroll handler work | <= 4 ms/frame | BROWSER |
| I10 | Resize response work | <= 16 ms/frame | BROWSER |

## Baseline 0 — 2026-07-18

Machine: Apple Silicon macOS, Node 24. Browser-only cells are pending because automated
localhost navigation was blocked; they must be filled from the same protocol, not guessed.

| Metric | Baseline |
|---|---:|
| Dev server ready | 121 ms |
| Production build | 857 ms, 153 modules |
| Initial app JS | 268.31 KB raw / 79.08 KB gzip |
| Eager vendor JS | 186.97 KB raw / 60.22 KB gzip |
| Total eager JS | 455.28 KB raw / 139.30 KB gzip |
| CSS | 116.11 KB raw / 21.25 KB gzip |
| Secondary route chunks | 0 (all route modules imported eagerly) |
| Worklets | 36.84 KB raw total |
| DSP worst-case | 421.9 us/block, 6.3x realtime headroom |
| Audio golden gate | 225/225 synth + 7/7 FX pass |
| DSP heap drift | -39 KB / 4,000 saturated blocks |
| Audible alias (saw/square/triangle/FM) | -41.11 / -54.95 / -71.85 / -51.34 dB |
| Visual deterministic workload | 0.338 ms optimized scenario; 78.18% fewer analyser samples vs old baseline |
| Browser route/Web-Vitals/memory metrics | pending live-browser access |

## First evidence-backed backlog

1. Route-level code splitting: seven secondary pages are in the initial module graph.
2. Stop or heavily throttle visual RAF loops while hidden; current loops still wake every display frame to check visibility.
3. Consolidate/adapt visual scheduling so inactive canvases do not compete for frame budget.
4. Remove development-tooling warnings (`type: module`, stale browserslist data, Vite CJS config path) after measuring impact and compatibility.
5. Add automated production-asset budgets and route-chunk assertions.
6. Fill browser-only baselines, then prioritize React fan-out, DOM size, long tasks, and interaction delay using measured traces.

## Optimization batch 1 — delivery and visual lifecycle

Collected with the same production build and deterministic workload protocols as Baseline 0.
Browser-only metrics remain pending until the Browser localhost policy permits a fresh trace.

| Metric | Baseline 0 | Batch 1 | Change |
|---|---:|---:|---:|
| Initial JS raw | 444.61 KiB | 328.60 KiB | -26.1% |
| Initial JS gzip | 136.04 KiB | 87.46 KiB | -35.7% |
| Initial CSS raw | 113.39 KiB | 67.57 KiB | -40.4% |
| Initial CSS gzip | 20.75 KiB | 13.49 KiB | -35.0% |
| Largest eager JS chunk gzip | 77.23 KiB | 38.06 KiB | -50.7% |
| Initial JS requests | 4 | 3 | -25.0% |
| Secondary route chunks | 0 | 7 | target met |
| Static RAF scheduling calls | 21 | 11 | -47.6% |
| Hidden visual RAF callbacks | wake every display frame | 0 by scheduler contract | target met |
| 2D canvas pixels at DPR 2 | 4.00 / CSS px | 2.25 / CSS px | -43.75% |
| Visual hot-loop geometry reads | up to ~355/sec | 0 | removed |
| Visual deterministic CPU reduction vs legacy | 90.22% | 90.22% | no regression |

Implemented boundaries and controls:

- Seven secondary routes now load independently; their CSS is route-scoped.
- Decorative Scene, Wave Candy, and the MIDI radar no longer block the interactive shell.
- The MIDI parser and its 9.55 KB gzip dependency load only when MIDI is requested.
- Closed sidebar panels no longer import MIDI browsing or the 30 KB AudioControls source;
  hover/focus prefetch preserves fast first-open response.
- Four canvas loops share one tested visibility-aware scheduler and stop scheduling while hidden.
- Canvas backing stores use explicit DPR budgets and event-driven sizing rather than per-frame
  layout reads.
- `npm run perf:site` enforces nine production delivery budgets and fails on regressions.

### Batch 1 verification gates

- Full suite: 34 files, 442/442 tests pass.
- Production delivery: 9/9 enforced budgets pass.
- DSP headroom: 406.4 us/block in the isolated run, 6.6x realtime (5.7x minimum).
- Audio golden masters: 225/225 synth renders bit-exact; 7/7 FX renders pass.
- Saturated DSP heap drift: -43 KB over 4,000 blocks.
- Audible alias: saw -41.11 dB, square -54.95 dB, triangle -71.85 dB,
  FM-sine -51.34 dB; all thresholds pass.
- Deterministic visual workload: 90.22% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than its legacy reference.
- `git diff --check`: pass.

### Remaining measurement blocker

The in-app Browser rejected automated localhost navigation under its URL policy. N01-N15,
M01-M10, M12-M14, R01-R10, browser-derived A03-A07, L01-L08, and I01-I10 therefore
remain explicitly unmeasured. Do not infer those values from build or static evidence; resume
with cold/warm DevTools traces when the Browser policy permits localhost profiling.

## Optimization batch 2 — startup work, MIDI scale, UI cadence, and polling

Collected from an isolated production build, deterministic source/corpus measurements, and
fake-timer lifecycle tests. Browser-only cells remain pending and are not inferred here.

| Metric | Previous | Batch 2 | Change |
|---|---:|---:|---:|
| Initial JS raw | 328.60 KiB | 310.63 KiB | -5.5% |
| Initial JS gzip | 87.46 KiB | 80.92 KiB | -7.5% |
| Initial CSS raw | 67.57 KiB | 66.58 KiB | -1.5% |
| Initial CSS gzip | 13.49 KiB | 13.44 KiB | -0.4% |
| Initial JS requests | 3 | 2 | -33.3% |
| Largest eager JS chunk gzip | 38.06 KiB | 36.41 KiB | -4.3% |
| Production build, isolated | 857 ms baseline | 786 ms | -8.3% |
| Static RAF scheduling calls | 11 | 7 | -36.4% |
| Static `setInterval` calls | 3 | 0 | removed |
| MIDI progress React cadence | display refresh (~60 Hz) | 25 Hz | -58.3% at 60 Hz |
| Voice Loop playhead React cadence | display refresh (~60 Hz) | 25 Hz visible / 0 hidden | -58.3% visible |
| MIDI active-note UI cadence | up to every note edge | <= 25 Hz snapshots | bounded |
| Session persistence writes during rapid edits | one synchronous write/change | one write/200 ms + pagehide flush | coalesced |
| Effect macro dial idle draws | display refresh (~60 Hz) | 0 | removed |
| Effect macro dial active draws | display refresh (~60 Hz) | 24 Hz | -60.0% at 60 Hz |
| Worst shipped MIDI upfront timers | 38,118 | ~621 in first 2 s window | -98.4% |
| Sparse 10,000-note regression fixture timers | 20,000 | <= 7 upfront | >99.9% |
| Completed timeout handles retained | until playback stop | 0 | removed |
| Polling requests while hidden | every 2 seconds on 3 routes | 0 | removed |
| Overlapping polling requests | possible | 0 by scheduler contract | removed |
| Active voices after MIDI hook unmount | could remain sounding | 0 | removed |
| Built-in MIDI files parseable | 77/78 | 78/78 | restored |
| Direct runtime dependencies | 15 | 5 | -66.7% |
| Production dependency packages | 249 | 10 | -96.0% |
| Lockfile package entries | 514 | 422 | -17.9% |
| Production dependency vulnerabilities | not isolated | 0 | target met |
| Deterministic visual CPU reduction vs legacy | 90.22% | 91.43% | +1.21 pp |

Measured corpus evidence:

- The 78 shipped MIDI files contain 81,696 notes after normalizing the legacy Gnossienne
  `SEM1` metadata container. The largest score has 19,059 notes and previously allocated
  38,118 note timers at once.
- The same score peaks at 310 note starts in a two-second lookahead window. The rolling
  scheduler therefore allocates about 620 note timers plus one pump up front instead of work
  proportional to the entire 694.69-second score.
- The 10,000-note sparse regression fixture proves allocation follows window density rather
  than total score size, and stop/unmount tests prove pending handles return to zero.

Implemented boundaries and controls:

- Removed the unreachable startup voice-phrase render and its eager `klattsch` dependency
  path from the main route; the dedicated Voice Loop route retains voice synthesis.
- Memoized the keyboard and header across unrelated MIDI progress updates and stabilized
  their callback props.
- Progress and active-note visualization snapshots are capped at 25 Hz without changing
  audio event timing.
- MIDI playback uses a two-second rolling lookahead with a 500 ms non-audio pump, deletes
  fired handles from its tracked set, and stops active voices on hook unmount.
- Voice Loop playhead updates use the shared visibility-aware RAF lifecycle at 25 Hz.
- Three job/status routes share foreground-only, non-overlapping polling and immediately
  refresh when a hidden page becomes visible.
- Session writes are debounced for 200 ms and synchronously flushed on `pagehide`/unmount.
- The effect macro dial is event-driven while idle and capped at 24 Hz while audio is active.
- Seven unreachable runtime packages were removed (React Three, Three.js, postprocessing,
  Framer Motion, and the unused OpenAI SDK), while Tailwind/PostCSS tooling moved to the
  development tree. A production-only `npm audit` reports zero vulnerabilities.
- Explicit ESM/CommonJS package scopes remove Vite's CJS and Node's module-reparse warnings;
  refreshed Browserslist metadata removes the stale-data warning and trims generated CSS.

### Batch 2 verification gates

- Full suite: 35 files, 451/451 tests pass.
- Production delivery/static/dependency guardrails: 14/14 enforced budgets pass.
- Initial production payload: 310.63 KiB raw / 80.92 KiB gzip JS, 66.58 KiB raw /
  13.44 KiB gzip CSS, seven secondary route chunks.
- Deterministic visual workload: 91.43% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than its legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -19 KB over 4,000 blocks.
- Isolated DSP benchmark: 402.6 us per 128-frame block with 6.6x realtime headroom.

## Optimization batch 3 — render isolation, indexed score windows, and live probes

Collected from production assets, deterministic corpus benchmarks, and regression tests.
The new browser probe makes the remaining live-browser cells reproducible, but those values
remain pending while automated localhost navigation is unavailable.

| Metric | Previous | Batch 3 | Change |
|---|---:|---:|---:|
| Initial JS raw | 310.63 KiB | 311.65 KiB | +0.3% |
| Initial JS gzip | 80.92 KiB | 81.26 KiB | +0.4% |
| Initial CSS raw | 66.58 KiB | 66.58 KiB | unchanged |
| Production delivery budgets | 14/14 | 14/14 | no regression |
| Visual workload CPU reduction vs legacy | 91.43% | 92.20% | +0.77 pp |
| Sound panel renders caused by MIDI progress | every 40 ms while playing | 0 | removed |
| MIDI catalog reconciliations caused by progress | every 40 ms across 78 rows | 0 | removed |
| Tempo-control renders caused by progress | every 40 ms while playing | 0 | removed |
| Largest-score window queries (4,000 positions) | 345.31 ms | 1.37 ms | -99.6% |
| Largest-score window-query speedup | 1x | 251.2x | indexed lookup |
| Dry-default worklet module attempts | synth + delay + reverb | synth initially | 2 deferred |
| Browser profiling code in default production startup | unavailable | 0 eager bytes | opt-in chunk |

Measured corpus evidence:

- The indexed note-window implementation returned exactly the same notes as the linear scan
  at all 4,000 sampled positions in the shipped 19,059-note score.
- The indexed path completed in 1.37 ms versus 345.31 ms for repeated full-array scans. It
  performs binary-search bounds plus visible-window work instead of O(total notes) work on
  every Song Study progress update.
- A 20,000-note proxy regression fixture proves a query touches fewer than ten indexed note
  entries before returning its visible slice.

Implemented boundaries and controls:

- Sidebar context consumption now lives inside the lazy panel that needs it. MIDI progress
  cannot fan out through the sidebar root into the sound controls, and sound-control changes
  cannot force the MIDI catalog to reconcile.
- The MIDI library is a memoized component with a stable built-in catalog and memoized search
  results. Transport progress updates remain inside the player boundary.
- Scene, Wave Candy, and the tempo control use stable memo boundaries; the main app also
  exposes stable audio-parameter callbacks.
- Song Study builds one sorted note-window index per parsed score and shares it with the radar,
  avoiding both repeated full scans and a duplicate 19,059-note index.
- Delay and reverb worklets are initialized only when their enabled wet mix can be audible.
  The synth worklet remains eagerly prepared to preserve first-note latency.
- A dynamically imported performance probe is available in development and with `?profile=1`
  in production. `window.__vangelisPerf` records paint/LCP/CLS, long tasks, event timing,
  navigation/resource timing, worklet requests, memory when supported, DOM depth/node/canvas
  counts, route paint, and named manual interactions; it exports a JSON snapshot for the ledger.
  The probe is excluded from the default production startup graph.

### Batch 3 verification gates

- Focused regression suite: 7 files, 53/53 tests pass.
- Full suite: 37 files, 459/459 tests pass.
- Production delivery/static/dependency guardrails: 14/14 enforced budgets pass.
- Initial production payload: 311.65 KiB raw / 81.26 KiB gzip JS, 66.58 KiB raw /
  13.44 KiB gzip CSS, seven secondary route chunks.
- Deterministic visual workload: 92.20% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than its legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- `git diff --check`: pass.

## Optimization batch 4 — hidden MIDI lifecycle and font discovery

Collected from lifecycle tests, a production build, and the static delivery audit. Audio event
timing is intentionally unchanged; only visual publication and document delivery changed.

| Metric | Batch 3 | Batch 4 | Change |
|---|---:|---:|---:|
| Static explicit RAF sites | 7 | 5 | -28.6% |
| Hidden MIDI progress frames | browser-throttled RAF | 0 by scheduler contract | removed |
| Hidden sequenced-MIDI active-note commits | up to 25 Hz | 0 | removed |
| Hidden hardware-MIDI active-note commits | every note edge | 0 | removed |
| Hardware-MIDI visible snapshot cadence | every note edge | <= 25 Hz | bounded |
| Nested external CSS imports | 1 | 0 | removed |
| Early font preconnect origins | 0 | 2 | added |
| Automated production budgets | 14 | 15 | +1 guardrail |
| Initial JS raw | 311.65 KiB | 313.30 KiB | +0.5% |
| Initial JS gzip | 81.26 KiB | 81.62 KiB | +0.4% |
| Initial CSS raw | 66.58 KiB | 66.49 KiB | -0.1% |
| Initial CSS gzip | 13.44 KiB | 13.36 KiB | -0.6% |

Implemented boundaries and controls:

- MIDI progress now uses the shared visibility-aware animation scheduler. Playback and rolling
  audio scheduling continue while hidden, but progress painting stops completely and resumes
  from the audio clock when visible.
- A shared snapshot publisher decouples immediate audio note edges from rate-limited React
  visualization. It caps visible updates at 25 Hz, suppresses hidden updates, publishes one
  fresh snapshot on visibility return, and clears pending work on unmount.
- Both sequenced MIDI and hardware MIDI use the same tested publication lifecycle. Controller
  audio calls remain immediate even when multiple visual note changes are coalesced.
- IBM Plex Mono remains unchanged visually, but its stylesheet moved from a nested CSS import
  into the document head. Preconnects for the Google Fonts CSS and font origin begin connection
  setup before the main stylesheet is parsed.
- The production audit reports external stylesheet/preconnect topology and fails if a nested
  external CSS import is reintroduced.

### Batch 4 verification gates

- Full suite: 38 files, 463/463 tests pass.
- Production delivery/static/dependency guardrails: 15/15 enforced budgets pass.
- Initial production payload: 313.30 KiB raw / 81.62 KiB gzip JS, 66.49 KiB raw /
  13.36 KiB gzip CSS, seven secondary route chunks.
- Deterministic visual workload retains exact sample reductions: 78.18% fewer analyser samples
  and 65.71% fewer resample samples; the 20-second synthetic CPU sample was 91.06% below its
  legacy reference.
- `git diff --check`: pass.

## Optimization batch 5 — per-route application boundary

Collected from the Vite production manifest and its complete synchronous import closures.
Home includes Scene and Wave Candy because both lazy components mount immediately; conditional
Birds Eye Radar and closed sidebar panels remain excluded until requested.

| Metric | Batch 4 | Batch 5 | Change |
|---|---:|---:|---:|
| Common entry JS raw | 313.30 KiB | 147.59 KiB | -52.9% |
| Common entry JS gzip | 81.62 KiB | 47.64 KiB | -41.6% |
| Common entry CSS raw | 66.49 KiB | 53.70 KiB | -19.2% |
| Common entry CSS gzip | 13.36 KiB | 11.13 KiB | -16.7% |
| Common entry requests | 2 JS / 1 CSS | 2 JS / 1 CSS | unchanged |
| Route closures resolved | not enforced | 8/8 | target met |
| Maximum route JS gzip | not enforced | 92.15 KiB | < 100 KiB |
| Maximum route CSS gzip | not enforced | 16.30 KiB | < 18 KiB |
| Automated production budgets | 15 | 18 | +3 guardrails |

Production route closures:

| Route | JS assets | JS gzip | CSS assets | CSS gzip |
|---|---:|---:|---:|---:|
| Home, including immediate Scene/Wave Candy | 13 | 91.59 KiB | 2 | 14.16 KiB |
| Control Kit | 4 | 54.37 KiB | 2 | 13.40 KiB |
| Generated Study | 15 | 85.50 KiB | 3 | 15.71 KiB |
| MIDI Pipeline | 8 | 70.24 KiB | 3 | 16.30 KiB |
| Song Study | 12 | 83.82 KiB | 3 | 15.71 KiB |
| Sound Designer | 12 | 92.15 KiB | 3 | 15.87 KiB |
| Study Songs | 8 | 68.16 KiB | 3 | 15.54 KiB |
| Voice Loop | 8 | 78.33 KiB | 3 | 16.25 KiB |

Implemented boundaries and controls:

- The home synthesizer is now a route-level lazy entry, so direct visits to Sound Designer,
  Studies, Pipeline, Voice Loop, and Control Kit do not download the home MIDI scheduler,
  keyboard interaction stack, sidebar shell, or home-only audio orchestration before routing.
- Built-in study slug resolution moved into the Song Study chunk. The bootstrap no longer
  imports the audio parameter model, math helpers, or DSP constants merely to validate a URL.
- The production build emits a Vite manifest. The audit recursively resolves static imports
  and CSS for eight route entry points, rather than relying only on HTML-linked asset size.
- Three new gates require every route closure to resolve and cap the maximum route closure at
  100 KiB gzip JS and 18 KiB gzip CSS.

### Batch 5 verification gates

- Full suite: 38 files, 463/463 tests pass.
- Production delivery/static/dependency/route guardrails: 18/18 pass.
- Build: 161 transformed modules in 799 ms; seven secondary page chunks plus a dedicated home
  application chunk and shared feature chunks.
- `git diff --check`: pass.

## Optimization batch 6 — deployment hygiene and deferred factory bank

Collected from the production manifest, exact static-file sizes, focused interaction tests,
the full suite, and the audio/visual deterministic gates.

| Metric | Batch 5 / same-build counterfactual | Batch 6 | Change |
|---|---:|---:|---:|
| Public static bytes | 1,180.95 KiB | 860.05 KiB | -27.2% |
| Production deployment bytes | 1,893.63 KiB | 1,572.73 KiB | -16.9% |
| Retired Raylib deploy payload | 320.90 KiB | 0 | removed |
| Retired Raylib public files | 3 | 0 | removed |
| Sound Designer startup JS gzip | 92.15 KiB | 88.44 KiB | -4.0% |
| Factory preset bank in folded startup closure | 6.43 KiB gzip | 0 | deferred |
| Factory preset bank interaction chunk | none | 33.18 KiB / 6.43 KiB gzip | isolated |
| Initial JS gzip | 47.64 KiB | 47.64 KiB | unchanged |
| Total production CSS raw | 112.70 KiB | 112.42 KiB | -0.2% |
| Automated production budgets | 18 | 22 | +4 guardrails |

Implemented boundaries and controls:

- Removed the retired Emscripten Raylib JavaScript/WASM pair, its source/build toolchain, and
  dead `.wave-candy--raylib` selectors. The current Canvas suite remains the only visualizer.
- The audit now measures total deployment and `public/` footprint and enforces 1.65 MiB and
  0.95 MiB raw ceilings, catching static baggage that JS/CSS asset budgets cannot see.
- Split the 45 fully specified factory patches from localStorage user-preset operations. The
  Sound Designer retains its 45-patch count and selected user-preset readout without loading
  the factory parameter tables.
- The folded Sound Designer bank loads on browse or previous/next interaction. The sidebar's
  always-open preset browser still starts the load when its already-lazy Sound panel mounts.
- Dynamic-bank loading deduplicates concurrent requests, exposes loading/error states, avoids
  post-unmount state publication, and preserves user preset save/delete behavior.
- Manifest guards require a dedicated factory-bank chunk and fail if it re-enters the folded
  Sound Designer startup closure.

### Batch 6 verification gates

- Full suite: 39 files, 467/467 tests pass, including 139 factory-patch range invariants and
  four new user-storage lifecycle tests.
- Production delivery/static/dependency/route guardrails: 22/22 pass.
- Deterministic visual workload: 91.83% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 409.6 us per 128-frame block with 6.5x realtime headroom.
- `git diff --check`: pass.

## Optimization batch 7 — post-commit Web MIDI startup

Collected from production-manifest route closure analysis, focused hardware-controller
lifecycle tests, the full suite, and the audio/visual deterministic gates.

| Metric | Batch 6 | Batch 7 | Change |
|---|---:|---:|---:|
| Home startup JS gzip | 91.59 KiB | 91.14 KiB | -0.5% |
| Web MIDI startup path | synchronous in App | post-commit async | moved out |
| Web MIDI interaction chunk | none | 1.45 KiB / 0.82 KiB gzip | isolated |
| Initial JS gzip | 47.64 KiB | 47.65 KiB | effectively unchanged |
| Production deployment bytes | 1,572.73 KiB | 1,573.05 KiB | +0.02% chunk/manifest overhead |
| Automated production budgets | 22 | 24 | +2 guardrails |

Implemented boundaries and controls:

- Moved hardware MIDI parsing, browser permission discovery, device hot-plug handling, and
  audio dispatch into a dynamically imported, React-free controller module.
- Browsers without `navigator.requestMIDIAccess` now skip the controller download entirely.
  Supported browsers initialize it after the first application commit while preserving
  automatic connection behavior.
- Kept the React hook responsible only for low-frequency visible note snapshots and current
  synth-parameter references. MIDI note/audio events remain immediate after connection.
- Cleanup detaches every input and state listener, stops held hardware notes, and resets pitch
  bend and modulation state. Permission denial and deferred import errors remain non-fatal.
- Manifest guards require a dedicated Web MIDI controller chunk and fail if it re-enters the
  synchronous home route closure.

### Batch 7 verification gates

- Full suite: 40 files, 469/469 tests pass, including direct controller note, continuous
  controller, hot-plug, all-notes-off, and cleanup coverage.
- Production delivery/static/dependency/route guardrails: 24/24 pass.
- Deterministic visual workload: 92.57% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.1 us per 128-frame block with 6.6x realtime headroom.
- `git diff --check`: pass.

## Optimization batch 8 — Sound Designer control isolation

Collected from production module attribution, manifest route-closure analysis, component
regression tests, the full suite, and the audio/visual deterministic gates.

| Metric | Batch 7 | Batch 8 | Change |
|---|---:|---:|---:|
| Sound Designer startup JS gzip | 88.45 KiB | 83.16 KiB | -6.0% |
| Sound Designer startup JS raw | 320.55 KiB | 288.52 KiB | -10.0% |
| Full sidebar sound panel in Sound Designer closure | 10.43 KiB gzip shared chunk | 0 | isolated |
| Deferred sidebar sound panel | coupled to shared controls | 16.02 KiB / 5.40 KiB gzip | dedicated |
| Shared primitive/preset asset | embedded in full panel | 23.33 KiB / 4.89 KiB gzip | dedicated |
| Total production JS raw | 588.71 KiB | 570.92 KiB | -3.0% |
| Total production JS gzip | 169.04 KiB | 168.33 KiB | -0.4% |
| Production deployment bytes | 1,573.05 KiB | 1,555.27 KiB | -1.1% |
| Automated production budgets | 24 | 26 | +2 guardrails |

Implemented boundaries and controls:

- Production attribution showed that Sound Designer's 2.82 KiB gzip page module imported the
  entire 10.43 KiB gzip studio sidebar-control chunk solely for slider descriptions and a few
  shared control components.
- Extracted slider mappings, the reusable slider wrapper, and the modulation-matrix editor into
  a shared primitive module. Both the studio panel and Sound Designer consume the same source,
  so the reduction does not duplicate control logic.
- Kept collapsible panel state, effect-dial rendering, delay/reverb advanced controls, and
  sidebar-only presentation in the deferred Sound tab chunk.
- Manifest guards require the dedicated Sound tab chunk and fail if it re-enters Sound
  Designer's static route closure.

### Batch 8 verification gates

- Full suite: 40 files, 469/469 tests pass, including the Audio Controls and 20-test Sound
  Designer interaction suites.
- Production delivery/static/dependency/route guardrails: 26/26 pass.
- Deterministic visual workload: 93.37% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark remains 405.1 us per 128-frame block with 6.6x realtime headroom;
  Batch 8 does not touch the audio engine or worklets.
- `git diff --check`: pass.

## Optimization batch 9 — interaction-loaded MIDI parsing

Collected from production manifest import edges, route-closure analysis, a pasted-file
component regression, the full suite, and the audio/visual deterministic gates.

| Metric | Batch 8 | Batch 9 | Change |
|---|---:|---:|---:|
| Home startup JS gzip | 91.13 KiB | 87.71 KiB | -3.8% |
| Home startup JS raw | 317.48 KiB | 302.68 KiB | -4.7% |
| Home static JS assets | 13 | 12 | -1 asset |
| MIDI parser in home static closure | 3.55 KiB gzip | 0 | deferred |
| MIDI parser interaction chunk | static home dependency | 15.23 KiB / 3.55 KiB gzip | on paste/open |
| Total production JS gzip | 168.33 KiB | 168.49 KiB | +0.1% async-boundary overhead |
| Production deployment bytes | 1,555.27 KiB | 1,555.84 KiB | +0.04% |
| Automated production budgets | 26 | 29 | +3 guardrails |

Implemented boundaries and controls:

- Production manifest evidence showed that App statically imported the catalog/parser module
  only for the global pasted-file handler, adding it to every home visit despite no MIDI use.
- The paste handler now imports the parser after identifying a `.mid`/`.midi` file. Existing
  MIDI library and Song Study flows keep their route-appropriate parser imports, while the
  underlying `@tonejs/midi` decoder remains a second-level dynamic import.
- Added an App-level regression that pastes a MIDI `File`, awaits the deferred parser, starts
  playback, opens the MIDI panel, and publishes the success notice.
- Manifest guards require the parser chunk, require App to list it as a dynamic import, and
  fail if it returns to the home static route closure.

### Batch 9 verification gates

- Full suite: 40 files, 470/470 tests pass.
- Production delivery/static/dependency/route guardrails: 29/29 pass.
- Deterministic visual workload: 92.07% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark remains 405.1 us per 128-frame block with 6.6x realtime headroom;
  Batch 9 does not touch the audio engine or worklets.
- `git diff --check`: pass.

## Optimization batch 10 — pure shared header and route engine isolation

Collected from production module attribution, per-route manifest closures, controlled-header
component tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 9 | Batch 10 | Change |
|---|---:|---:|---:|
| MIDI Pipeline startup JS gzip | 70.24 KiB | 59.35 KiB | -15.5% |
| Study Library startup JS gzip | 68.17 KiB | 57.27 KiB | -16.0% |
| Voice Loop startup JS gzip | 78.34 KiB | 64.65 KiB | -17.5% |
| Home startup JS gzip | 87.71 KiB | 86.11 KiB | -1.8% |
| Generated Study startup JS gzip | 85.56 KiB | 84.00 KiB | -1.8% |
| Built-in Study startup JS gzip | 83.89 KiB | 82.30 KiB | -1.9% |
| Sound Designer startup JS gzip | 83.16 KiB | 81.53 KiB | -2.0% |
| Passive routes importing shared audio engine | 4 | 0 | removed |
| AppHeader engine subscriptions per mount | 2 | 0 | removed |
| Total production JS raw | 571.39 KiB | 546.59 KiB | -4.3% |
| Total production JS gzip | 168.49 KiB | 166.95 KiB | -0.9% |
| Production deployment bytes | 1,555.84 KiB | 1,531.77 KiB | -1.5% |
| Automated production budgets | 29 | 31 | +2 guardrails |

Implemented boundaries and controls:

- Module attribution showed that the shared AppHeader imported and subscribed to the full
  audio engine even on routes where it rendered only the brand. This forced engine, graph,
  recorder, sample-pool, and worklet-loader code into passive route closures.
- Converted AppHeader to a controlled presentation component. The home App already supplies
  every sample/recording status value and callback; passive routes supply no actions and now
  mount a subscription-free brand header.
- Removed unused local sample/loading/recording fallback state and duplicate engine and
  recording subscriptions. Sample upload, clear, and record controls retain the same behavior
  through their existing App-owned callbacks.
- Added direct passive/controlled header tests and manifest guards that fail if AppHeader
  imports the engine or if Control Kit, MIDI Pipeline, Study Library, or Voice Loop regain the
  shared `audioEngine` chunk.

### Batch 10 verification gates

- Full suite: 41 files, 472/472 tests pass.
- Production delivery/static/dependency/route guardrails: 31/31 pass.
- Deterministic visual workload: 88.14% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.9 us per 128-frame block with 6.5x realtime headroom. A
  deliberately discarded contended run overlapped the full suite/audio audit; only the
  isolated run satisfies the collection protocol.
- `git diff --check`: pass.

## Optimization batch 11 — rail-only chrome for passive routes

Collected from production module attribution, manifest-derived sidebar identity, per-route
closures, navigation-contract tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 10 | Batch 11 | Change |
|---|---:|---:|---:|
| Generated Study startup JS gzip | 84.00 KiB | 81.12 KiB | -3.4% |
| MIDI Pipeline startup JS gzip | 59.35 KiB | 56.82 KiB | -4.3% |
| Built-in Study startup JS gzip | 82.30 KiB | 79.44 KiB | -3.5% |
| Study Library startup JS gzip | 57.27 KiB | 54.74 KiB | -4.4% |
| Voice Loop startup JS gzip | 64.65 KiB | 62.12 KiB | -3.9% |
| Sound Designer startup JS gzip | 81.53 KiB | 80.69 KiB | -1.0% |
| Navigation-only routes with full sidebar controller | 5 | 0 | removed |
| Full sidebar controller chunk | mixed into shared chrome | 7.03 KiB / 1.98 KiB gzip | isolated |
| Shared rail chunk | mixed into full sidebar | 2.57 KiB / 0.99 KiB gzip | reusable |
| Passive brand/navigation wrapper | mixed into full sidebar | 0.53 KiB / 0.32 KiB gzip | reusable |
| Direct passive-route static JS assets | baseline | +1 small shared asset | explicit trade |
| Total production JS raw | 546.59 KiB | 543.12 KiB | -0.6% |
| Total production JS gzip | 166.95 KiB | 167.07 KiB | +0.1% split overhead |
| Production deployment bytes | 1,531.77 KiB | 1,528.77 KiB | -0.2% |
| Automated production budgets | 31 | 33 | +2 guardrails |

Implemented boundaries and controls:

- Navigation-only pages intentionally showed a disabled rail, but did so by mounting the full
  Sidebar component. They therefore parsed panel state, mobile body-lock effects, Escape-key
  listeners, context consumers, backdrop logic, and lazy MIDI/Sound panel loaders that could
  never become active on those pages.
- Extracted the visual/navigation rail into a memoized shared component used by both the full
  interactive Sidebar and a lightweight passive wrapper. The brand masthead and passive wrapper
  share one module to limit small-chunk request fan-out.
- Home and Sound Designer retain the complete interactive sidebar. Generated Study, MIDI
  Pipeline, built-in Study, Study Library, and Voice Loop retain the same disabled Sound/MIDI
  buttons, keyboard link, Design link, rail styling, and DSP status without panel machinery.
- Added a direct passive-rail contract test and manifest guards that identify the full Sidebar
  by its MIDI/Sound lazy imports, then fail if any navigation-only route regains that chunk.

### Batch 11 verification gates

- Full suite: 42 files, 474/474 tests pass.
- Production delivery/static/dependency/route guardrails: 33/33 pass.
- Deterministic visual workload: 89.89% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 409.8 us per 128-frame block with 6.5x realtime headroom.
- `git diff --check`: pass.

## Optimization batch 12 — state-gated Generated Study player

Collected from production module attribution, manifest static/dynamic edges, running/completed
job transition tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 11 | Batch 12 | Change |
|---|---:|---:|---:|
| Generated Study startup JS gzip | 81.12 KiB | 55.12 KiB | -32.0% |
| Generated Study startup JS raw | 245.59 KiB | 170.12 KiB | -30.7% |
| Generated Study static JS assets | 17 | 10 | -7 assets |
| Song Study player in status-shell closure | full player | 0 | deferred |
| MIDI parser in status-shell closure | 3.63 KiB gzip | 0 | deferred |
| Engine/keyboard chunk in status-shell closure | 12.32 KiB gzip | 0 | deferred |
| Generated Study CSS gzip | 15.67 KiB | 15.67 KiB | unchanged status styling |
| Total production JS raw | 543.12 KiB | 548.74 KiB | +1.0% transition/fallback overhead |
| Total production JS gzip | 167.07 KiB | 167.64 KiB | +0.3% transition/fallback overhead |
| Production deployment bytes | 1,528.77 KiB | 1,534.40 KiB | +0.4% |
| Automated production budgets | 33 | 36 | +3 guardrails |

Implemented boundaries and controls:

- Generated Study previously imported the complete Song Study player before its first job API
  response. Running, failed, and missing jobs therefore parsed the synth keyboard, radar, MIDI
  scheduler, parser, and audio engine even though they could only render a status message.
- The status shell now owns only polling, job-to-study conversion, brand/navigation chrome,
  and its existing styled readouts. A completed job with a merged-MIDI artifact triggers a
  React lazy transition into Song Study.
- Added a branded, rail-preserving Suspense fallback for the short player-chunk transition;
  the route never flashes a blank document.
- Added tests proving running jobs remain in the lightweight shell and completed jobs load the
  player. Manifest guards require the Generated-to-Song-Study dynamic edge and prohibit player,
  parser, or engine chunks from its static closure.
- Strengthened the pre-existing engine guard: it now identifies the engine/keyboard chunk by
  its delay and reverb worklet assets rather than an optimizer-dependent filename. This restored
  accurate engine presence reporting after Rollup regrouped shared modules.

### Batch 12 verification gates

- Full suite: 43 files, 476/476 tests pass.
- Production delivery/static/dependency/route guardrails: 36/36 pass.
- Deterministic visual workload: 89.22% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.4 us per 128-frame block with 6.5x realtime headroom.
- `git diff --check`: pass.

## Optimization batch 13 — deferred Sound Designer visualizer and retired WASM transforms

Collected from production manifest closures, build-plugin/source-import attribution, the
Sound Designer live-scope contract test, the full suite, and isolated audio/visual gates.

| Metric | Batch 12 | Batch 13 | Change |
|---|---:|---:|---:|
| Sound Designer startup JS gzip | 80.68 KiB | 73.97 KiB | -8.3% |
| Sound Designer startup JS raw | 253.94 KiB | 224.10 KiB | -11.7% |
| Sound Designer static JS assets | 15 | 12 | -3 assets |
| WaveCandy in Sound Designer static closure | present | 0 | deferred |
| Home startup JS gzip | 85.94 KiB | 83.76 KiB | -2.5% |
| Total production JS raw | 548.74 KiB | 500.49 KiB | -8.8% |
| Total production JS gzip | 167.64 KiB | 163.97 KiB | -2.2% |
| Production deployment bytes | 1,534.40 KiB | 1,486.31 KiB | -3.1% |
| Lockfile package entries (excluding root) | 422 | 405 | -4.0% |
| Obsolete WASM/top-level-await build plugins | 2 | 0 | removed |
| Source WASM module imports | 0 | 0 | confirmed absent |
| Production dependency vulnerabilities | 0 | 0 | unchanged |
| Automated production budgets | 36 | 40 | +4 guardrails |

Implemented boundaries and controls:

- Sound Designer statically imported the complete WaveCandy visualizer even though it is a
  secondary, decorative readout below the primary design workspace. The route now paints a
  dimensionally stable placeholder and loads WaveCandy through a post-commit Suspense boundary,
  matching the already-deferred home-page visualizer pattern.
- The live-scope contract test now waits for the deferred component and still proves that the
  oscilloscope, spectrum, level meter, vectorscope, and spectrogram remain mounted together.
- Source and manifest attribution confirmed that the retired Raylib path left no `.wasm` module
  imports, but Vite still ran every module through `vite-plugin-wasm` and
  `vite-plugin-top-level-await`. Removing those transforms eliminated their dependency closure
  and avoided top-level-await wrapper expansion around nested dynamic routes.
- Manifest guards now require the Sound Designer-to-WaveCandy dynamic edge, prohibit WaveCandy
  from the route's static closure, prohibit the obsolete build plugins, and require zero source
  WASM module imports.

### Batch 13 verification gates

- Full suite: 43 files, 476/476 tests pass.
- Production delivery/static/dependency/route guardrails: 40/40 pass.
- Deterministic visual workload: 91.25% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.5 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 14 — interaction-loaded Sound Designer stages

Collected from production manifest static/dynamic closures, stage-navigation contract tests,
the full suite, and isolated audio/visual gates.

| Metric | Batch 13 | Batch 14 | Change |
|---|---:|---:|---:|
| Sound Designer Base startup JS gzip | 73.97 KiB | 70.26 KiB | -5.0% |
| Sound Designer Base startup JS raw | 224.10 KiB | 211.95 KiB | -5.4% |
| Sound Designer Base static JS assets | 12 | 11 | -1 asset |
| Advanced stages in Base static closure | all four | 0 | deferred |
| Advanced control primitives in Base static closure | present | 0 | deferred |
| Advanced-stage interaction delta | static startup cost | 13.59 KiB / 4.68 KiB gzip | 3 on-demand assets |
| Sound Designer CSS gzip | 15.83 KiB | 15.85 KiB | +0.1% stable fallback |
| Total production JS raw | 500.49 KiB | 501.96 KiB | +0.3% split/fallback overhead |
| Total production JS gzip | 163.97 KiB | 164.99 KiB | +0.6% split/fallback overhead |
| Production deployment bytes | 1,486.31 KiB | 1,488.60 KiB | +0.2% |
| Automated production budgets | 40 | 42 | +2 guardrails |

Implemented boundaries and controls:

- The default Base screen parsed and initialized the complete Tone, Motion, Space, and Mint
  component tree plus every advanced slider and modulation primitive, although those controls
  cannot render before stage navigation.
- Moved all four advanced stages behind one React lazy boundary. Base retains its waveform and
  folded-preset workflow, so the immediately useful design surface remains complete.
- Pointer hover and keyboard focus begin preloading the advanced module before activation. A
  dimensionally stable, styled card fallback covers direct clicks and slow connections without
  collapsing the workspace.
- Updated the page contracts to await the real asynchronous boundary while preserving free stage
  navigation, ordered back/next controls, parameter groups, mint persistence, and the persistent
  keyboard and visualizer.
- Manifest guards require the advanced-stage dynamic edge and fail if either the advanced-stage
  module or shared audio control primitives returns to the Base static closure.

### Batch 14 verification gates

- Full suite: 43 files, 476/476 tests pass.
- Production delivery/static/dependency/route guardrails: 42/42 pass.
- Deterministic visual workload: 92.24% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.2 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 15 — idle/interaction audio graph warmup

Collected from playable-route source attribution, deterministic warmup and first-note tests,
production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 14 | Batch 15 | Change |
|---|---:|---:|---:|
| Playable routes warming audio during mount | 3 | 0 | removed |
| Playable routes using idle/interaction warmup | 0 | 3 | complete coverage |
| Mount-path AudioContext creation triggers | 3 | 0 | deferred |
| Mount-path synth-worklet request triggers | 3 | 0 | deferred |
| First cold keyboard note behavior | could be dropped | queued after worklet readiness | fixed |
| Released pending keyboard note behavior | not applicable | cancelled before playback | guarded |
| MIDI play readiness | AudioContext only | AudioContext + synth worklet | first note protected |
| Home startup JS gzip | 83.77 KiB | 84.16 KiB | +0.5% scheduler/safety logic |
| Song Study startup JS gzip | 78.72 KiB | 79.09 KiB | +0.5% scheduler/safety logic |
| Sound Designer startup JS gzip | 70.26 KiB | 70.62 KiB | +0.5% scheduler/safety logic |
| Total production JS raw | 501.96 KiB | 503.12 KiB | +0.2% |
| Total production JS gzip | 164.99 KiB | 165.37 KiB | +0.2% |
| Production deployment bytes | 1,488.60 KiB | 1,489.92 KiB | +0.1% |
| Automated production budgets | 42 | 44 | +2 guardrails |

Implemented boundaries and controls:

- Home, Sound Designer, and Song Study each created the shared AudioContext and requested the
  synth worklet inside their mount effect. That work competed with the first visual render even
  when a visitor never played audio.
- A shared scheduler now begins preparation on the browser's idle callback (with a bounded
  timeout) or the first captured pointer/touch/keyboard interaction, whichever happens first.
  It cancels cleanly on route unmount and remains idempotent under React Strict Mode.
- Keyboard playback now records a cold first-note request, prepares the worklet, then plays it.
  Releasing the key or pointer during preparation cancels the pending note, preventing a late or
  stuck voice. The already-ready path remains synchronous.
- MIDI play, resume, and seek preparation now explicitly awaits the synth worklet in addition to
  resuming the AudioContext, preventing the first scheduler window from targeting an unready
  processor.
- Added three scheduler tests, three first-note lifecycle tests, and static guards requiring all
  three playable routes to use the deferred hook with zero direct mount warmup calls.

### Batch 15 verification gates

- Full suite: 45 files, 482/482 tests pass.
- Production delivery/static/dependency/route guardrails: 44/44 pass.
- Deterministic visual workload: 93.00% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact workload counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 407.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 16 — post-paint idle visual activation

Collected from critical/decorated production manifest closures, deterministic scheduler tests,
initial-render component assertions, the full suite, and isolated audio/visual gates.

| Metric | Batch 15 | Batch 16 | Change |
|---|---:|---:|---:|
| Home critical startup JS gzip | 84.16 KiB | 75.43 KiB | -10.4% |
| Home critical startup JS raw | 247.71 KiB | 227.49 KiB | -8.2% |
| Home critical startup JS assets | 15 | 11 | -4 assets |
| Scene/WaveCandy in Home critical closure | both | 0 | deferred |
| Home decorated-state JS gzip | immediate 84.16 KiB | 84.57 KiB | post-paint idle |
| Home deferred visual delta | mixed into startup | 21.27 KiB / 9.14 KiB gzip | 4 idle assets |
| Sound Designer deferred visual delta | immediate after mount | 12.10 KiB / 5.03 KiB gzip | 4 idle assets |
| Deferred visual mount points | 0 | 3 | Home x2 + Designer x1 |
| Hidden-document visual allocation | possible | 0 until visible | guarded |
| Total production JS raw | 503.12 KiB | 504.29 KiB | +0.2% scheduler overhead |
| Total production JS gzip | 165.37 KiB | 165.83 KiB | +0.3% scheduler overhead |
| Production deployment bytes | 1,489.92 KiB | 1,491.17 KiB | +0.1% |
| Automated production budgets | 44 | 47 | +3 guardrails |

Implemented boundaries and controls:

- Home mounted the ambient WebGL scene and five-pane analyser immediately, causing their chunks,
  canvas setup, WebGL context, shader compilation, analyser buffers, and animation loops to begin
  alongside the primary keyboard workspace. Sound Designer did the same for its analyser strip.
- A shared visual scheduler now waits for a committed paint and then uses an idle callback with a
  bounded timeout. Browsers without idle callbacks use a post-frame timer fallback.
- Home schedules the visible analyser and ambient WebGL scene independently, allowing the primary
  visual to activate first. Sound Designer uses the same primary-visual policy while preserving
  its dimensionally stable analyser placeholder.
- Hidden documents do not schedule frames, idle work, canvases, or WebGL contexts; activation starts
  only after visibility returns. All pending frame/idle/timer work cancels on route unmount.
- The production report now distinguishes critical route closures from fully decorated closures.
  Manifest/source guards require dynamic Home visual imports, exclude both visual modules from the
  critical closure, and require all three visual mount points to use deferred scheduling.

### Batch 16 verification gates

- Full suite: 46 files, 485/485 tests pass.
- Production delivery/static/dependency/route guardrails: 47/47 pass.
- Deterministic visual workload after activation: 89.48% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -19 KB over 4,000 blocks.
- Isolated DSP benchmark: 412.0 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 17 — effect-loaded Song Study parser

Collected from Song Study manifest edges and closures, page-level loading/error contracts, the
full suite, and isolated audio/visual gates.

| Metric | Batch 16 | Batch 17 | Change |
|---|---:|---:|---:|
| Song Study startup JS gzip | 79.10 KiB | 76.00 KiB | -3.9% |
| Song Study startup JS raw | 236.50 KiB | 226.00 KiB | -4.4% |
| Song Study static JS assets | 15 | 14 | -1 asset |
| MIDI parser in Song Study static closure | 10.77 KiB / 3.22 KiB gzip | 0 | deferred |
| Parser request timing | route evaluation | score-loading effect | moved off render path |
| Transport before parser readiness | disabled | disabled | preserved |
| Deferred parser failure UI | existing path | page-level test coverage | guarded |
| Total production JS raw | 504.29 KiB | 504.53 KiB | +0.05% boundary overhead |
| Total production JS gzip | 165.83 KiB | 165.93 KiB | +0.06% boundary overhead |
| Production deployment bytes | 1,491.17 KiB | 1,491.44 KiB | +0.02% |
| Automated production budgets | 47 | 49 | +2 guardrails |

Implemented boundaries and controls:

- Song Study statically imported the MIDI parser before rendering its existing score-loading UI,
  even though parsing could not begin until the loading effect received a study URL.
- The effect now imports the parser and then parses the requested score. The existing cancellation
  guard still ignores results after study changes or route unmount, and load errors retain the
  same visible recovery state.
- Added page-level tests proving the transport remains disabled while the parser resolves, becomes
  playable after parsed notes arrive, and exposes the existing alert when deferred parsing fails.
- Manifest guards require the Song Study-to-parser dynamic edge and fail if the parser returns to
  the route's static player-shell closure.

### Batch 17 verification gates

- Full suite: 47 files, 487/487 tests pass.
- Production delivery/static/dependency/route guardrails: 49/49 pass.
- Deterministic visual workload: 91.96% lower CPU time, 78.18% fewer analyser samples, and
  65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 409.1 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 18 — score-gated Song Study radar

Collected from Song Study loading/ready component transitions, manifest closures, the full suite,
and isolated audio/visual gates.

| Metric | Batch 17 | Batch 18 | Change |
|---|---:|---:|---:|
| Song Study startup JS gzip | 76.00 KiB | 73.04 KiB | -3.9% |
| Song Study startup JS raw | 226.00 KiB | 219.53 KiB | -2.9% |
| Song Study static JS assets | 14 | 13 | -1 asset |
| Radar/physics in score-loading closure | present | 0 | score-gated |
| Radar canvas allocation before parsed MIDI | 1 | 0 | removed |
| Loading-stage radar footprint | live empty canvas | stable CSS placeholder | layout preserved |
| Total production JS raw | 504.53 KiB | 504.94 KiB | +0.08% transition overhead |
| Total production JS gzip | 165.93 KiB | 166.07 KiB | +0.08% transition overhead |
| Production deployment bytes | 1,491.44 KiB | 1,492.08 KiB | +0.04% |
| Automated production budgets | 49 | 51 | +2 guardrails |

Implemented boundaries and controls:

- Song Study mounted BirdsEyeRadar while its score was still loading, which parsed the radar and
  canvas helpers, created particles and caches, allocated a canvas, and began an empty-state RAF
  loop before any MIDI notes existed.
- Radar is now a lazy component gated by `displayMidi`. The loading and Suspense states use the
  same `birds-eye-radar__stage` surface and existing fixed clamp height, preventing layout shift.
- Extended the Song Study transition test to prove the radar is absent while parsing and appears
  after the score resolves alongside the enabled transport.
- Manifest guards require the Song Study-to-radar dynamic edge and prohibit the radar chunk from
  returning to the static score-loading shell.

### Batch 18 verification gates

- Full suite: 47 files, 487/487 tests pass.
- Production delivery/static/dependency/route guardrails: 51/51 pass.
- Deterministic visual workload after activation: 93.01% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 411.4 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- `git diff --check`: pass.

## Optimization batch 19 — purpose-built global CSS pipeline

Collected from source-class attribution, generated-CSS inspection, production bundle metrics,
dependency-lock analysis, the full suite, and isolated audio/visual gates.

| Metric | Batch 18 | Batch 19 | Change |
|---|---:|---:|---:|
| Initial/global CSS raw | 53.42 KiB | 46.67 KiB | -12.6% |
| Initial/global CSS gzip | 11.11 KiB | 9.48 KiB | -14.7% |
| Generated Tailwind custom-property occurrences | 153 | 0 | removed |
| Tailwind source directives | 3 | 0 | removed |
| Tailwind build dependency | present | 0 | removed |
| Lockfile packages | 405 | 314 | -91 packages / -22.5% |
| Production deployment bytes | 1,492.08 KiB | 1,485.39 KiB | -6.69 KiB |
| Automated production budgets | 51 | 55 | +4 guardrails |

Implemented boundaries and controls:

- Source analysis found no Tailwind utility classes, `@apply`, theme lookups, or plugins, while
  the three Tailwind directives still emitted the complete preflight, 53 distinct `--tw-*`
  variables, global backdrop state, and unused positional/display utility selectors.
- Removed Tailwind from PostCSS, the development dependency graph, the lockfile, and project
  configuration. Autoprefixer and PostCSS remain in place to preserve browser compatibility.
- Replaced the broad generated preflight with a compact, explicit normalization layer for the
  elements this application actually renders: headings and copy, lists, links, forms, tables,
  media/canvas elements, borders, and hidden content. Existing app typography, control, and
  layout rules remain authoritative.
- Added production guards that prohibit Tailwind dependencies, source directives, and generated
  `--tw-*` variables, plus a selector-presence guard for eight critical global UI surfaces.

### Batch 19 verification gates

- Full suite: 47 files, 487/487 tests pass.
- Production delivery/static/dependency/route guardrails: 55/55 pass.
- Deterministic visual workload after activation: 90.96% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 422.5 us per 128-frame block with 6.3x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 20 — interaction-loaded audio runtime

Collected from production manifest closures, gateway lifecycle tests, cold keyboard and hardware-
MIDI contracts, the full suite, and isolated audio/visual gates.

| Metric | Batch 19 | Batch 20 | Change |
|---|---:|---:|---:|
| Home critical startup JS gzip | 75.40 KiB | 67.42 KiB | -10.6% |
| Home critical startup JS raw | 227.45 KiB | 202.17 KiB | -11.1% |
| Song Study startup JS gzip | 73.05 KiB | 65.10 KiB | -10.9% |
| Song Study startup JS raw | 219.53 KiB | 194.32 KiB | -11.5% |
| Sound Designer startup JS gzip | 70.98 KiB | 63.01 KiB | -11.2% |
| Sound Designer startup JS raw | 214.05 KiB | 188.80 KiB | -11.8% |
| Static playable-route audio runtime assets | 1 each | 0 | interaction-loaded |
| Deferred audio runtime chunk | mixed into startup | 28.49 KiB / 8.89 KiB gzip | dynamic entry |
| Cold hardware-MIDI first note | could be dropped | queued until ready | fixed |
| Total production JS raw | 504.94 KiB | 509.03 KiB | +0.8% split/gateway overhead |
| Total production JS gzip | 166.08 KiB | 167.49 KiB | +0.8% split/gateway overhead |
| Production deployment bytes | 1,485.39 KiB | 1,489.59 KiB | +0.3% |
| Automated production budgets | 55 | 57 | +2 guardrails |

Implemented boundaries and controls:

- Audio graph construction was already scheduled after first paint, but every playable route still
  downloaded the complete singleton, graph builder, worklet clients, recorder, sample pool, and
  effect helpers during its critical module evaluation.
- Split the public singleton into a small stateful gateway and a dynamic runtime entry. Cold status,
  subscription, analyser, playback, and recording contracts remain stable; the gateway replays the
  latest parameters and transport tempo as soon as the runtime arrives.
- Keyboard and MIDI transport readiness continue to queue their first requested note/play action.
  Hardware MIDI now uses the same contract: it updates the visual key immediately, waits for the
  worklet, plays only if the key is still held, and cancels a pending note on release or teardown.
- Keyboard note-frequency metadata now uses the existing pure math utilities, avoiding an engine
  dependency for a synchronous calculation.
- Manifest guards require the runtime to remain a dynamic entry and prohibit it from all eight
  static route closures. A source guard requires exactly one hardware-MIDI readiness path.

### Batch 20 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 57/57 pass.
- Deterministic visual workload after activation: 89.91% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.5 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 21 — visual-component CSS boundaries

Collected from production CSS manifest ownership, critical/decorated route closures, placeholder
geometry contracts, the full suite, and isolated audio/visual gates.

| Metric | Batch 20 | Batch 21 | Change |
|---|---:|---:|---:|
| Initial/global CSS raw | 46.67 KiB | 44.22 KiB | -5.2% |
| Initial/global CSS gzip | 9.48 KiB | 8.90 KiB | -6.1% |
| Home critical CSS gzip | 12.51 KiB | 11.94 KiB | -4.6% |
| Song Study critical CSS gzip | 14.06 KiB | 13.57 KiB | -3.5% |
| Sound Designer critical CSS gzip | 14.24 KiB | 13.67 KiB | -4.0% |
| Deferred WaveCandy CSS | mixed into global | 1.85 KiB / 0.78 KiB gzip | component-loaded |
| Deferred radar CSS | mixed into global | 0.80 KiB / 0.40 KiB gzip | score-loaded |
| Total production CSS raw | 105.91 KiB | 106.45 KiB | +0.5% split/placeholder overhead |
| Total production CSS gzip | 23.68 KiB | 24.37 KiB | +2.9% split/placeholder overhead |
| Production deployment bytes | 1,489.59 KiB | 1,490.43 KiB | +0.06% |
| Automated production budgets | 57 | 59 | +2 guardrails |

Implemented boundaries and controls:

- The global stylesheet shipped the complete five-pane analyser and MIDI radar rules to every
  route even though both canvas components already loaded after their respective idle/score gates.
- WaveCandy now owns its visualizer CSS chunk, including its compact responsive layout. The radar
  owns a separate CSS chunk with its canvas and responsive stage rules.
- Preserved first-paint geometry with a small global WaveCandy placeholder and a Song Study-owned
  radar placeholder. This prevents layout shift while avoiding the canvas/component styles on the
  critical path.
- Split a previously coupled stylesheet that also overrode keyboard/control width. The final
  keyboard and control widths remain unchanged, and Gruvbox `!important` theme overrides retain
  their existing priority independent of dynamic CSS arrival order.
- Manifest guards require one CSS asset for each deferred visual and fail if either the analyser
  grid or radar canvas selector returns to the initial stylesheet.

### Batch 21 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 59/59 pass.
- Deterministic visual workload after activation: 91.11% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.8 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 22 — playable-route keyboard CSS ownership

Collected from generated selector attribution, production CSS closures for all eight routes,
responsive-rule parity, the full suite, and isolated audio/visual gates.

| Metric | Batch 21 | Batch 22 | Change |
|---|---:|---:|---:|
| Initial/global CSS raw | 44.22 KiB | 37.08 KiB | -16.1% |
| Initial/global CSS gzip | 8.90 KiB | 7.50 KiB | -15.7% |
| Keyboard CSS | global | 7.28 KiB / 2.00 KiB gzip | playable-route asset |
| Control Kit critical CSS gzip | 11.17 KiB | 9.77 KiB | -12.5% |
| Generated Study shell CSS gzip | 13.57 KiB | 12.17 KiB | -10.3% |
| MIDI Pipeline critical CSS gzip | 14.08 KiB | 12.68 KiB | -9.9% |
| Study Library critical CSS gzip | 13.32 KiB | 11.92 KiB | -10.5% |
| Voice Loop critical CSS gzip | 14.03 KiB | 12.63 KiB | -10.0% |
| Home / Song / Designer CSS gzip | 11.94 / 13.57 / 13.67 KiB | 12.53 / 14.16 / 14.26 KiB | +0.59 KiB split cost each |
| Total production CSS raw | 106.45 KiB | 106.59 KiB | +0.1% |
| Total production CSS gzip | 24.37 KiB | 24.96 KiB | +2.4% split compression cost |
| Production deployment bytes | 1,490.43 KiB | 1,490.99 KiB | +0.04% |
| Automated production budgets | 59 | 61 | +2 guardrails |

Implemented boundaries and controls:

- The full virtual-keyboard stylesheet blocked every route, including pipeline, library, voice,
  control-kit, and generated-status screens that cannot render a keyboard.
- SynthKeyboard now owns its base stylesheet and all of its 1200/900/700/520 px responsive rules,
  including compact key geometry, touch labels, hints, and audio-warmup placement. This preserves
  rule order within one component asset rather than relying on a later global responsive file.
- Vite coalesces the shared keyboard CSS with the existing playable-route module, so Home, Song
  Study, and Sound Designer load it once while all five passive/status routes omit it.
- The tradeoff is explicit: playable routes pay one additional parallel CSS asset and about
  0.59 KiB of gzip split overhead, while initial CSS is 1.40 KiB smaller and every passive route
  saves that same 1.40 KiB. Total raw CSS is effectively flat.
- Build guards identify the keyboard asset by its generated selectors, prohibit those selectors
  in initial CSS, and require keyboard CSS on exactly the three playable route closures.

### Batch 22 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 61/61 pass.
- Deterministic visual workload after activation: 92.10% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.7 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 23 — interaction-loaded sound-panel CSS

Collected from JSX selector ownership, SoundTab manifest assets, all-route CSS closures, the full
suite, and isolated audio/visual gates.

| Metric | Batch 22 | Batch 23 | Change |
|---|---:|---:|---:|
| Initial/global CSS raw | 37.08 KiB | 30.87 KiB | -16.7% |
| Initial/global CSS gzip | 7.50 KiB | 6.49 KiB | -13.5% |
| Sound-panel CSS | global | 6.34 KiB / 1.52 KiB gzip | interaction-loaded |
| Home critical CSS gzip | 12.53 KiB | 11.52 KiB | -8.1% |
| Song Study critical CSS gzip | 14.16 KiB | 13.15 KiB | -7.1% |
| Sound Designer critical CSS gzip | 14.26 KiB | 13.25 KiB | -7.1% |
| Max passive-route critical CSS gzip | 12.68 KiB | 11.67 KiB | -8.0% |
| Critical routes containing SoundTab CSS | 8 | 0 | removed |
| Total production CSS raw | 106.59 KiB | 106.72 KiB | +0.1% |
| Total production CSS gzip | 24.96 KiB | 25.47 KiB | +2.0% split compression cost |
| Production deployment bytes | 1,490.99 KiB | 1,491.21 KiB | +0.01% |
| Automated production budgets | 61 | 63 | +2 guardrails |

Implemented boundaries and controls:

- Selector attribution showed that the global controls module belonged entirely to the Sound
  sidebar: AudioControls, UIOverlay, macro dials, collapsible groups, waveform choices, and their
  panel layout. The shared slider/select/toggle primitives used by Sound Designer remain in the
  global component foundation.
- SoundTab now imports its own base and responsive CSS. Its existing React dynamic boundary loads
  both code and styling on first Sound-tab interaction, rather than blocking every route.
- Moved only SoundTab-owned responsive rules (panel grid, macros, waveform choices, and footer)
  into the component asset. Shared label, slider, toggle, and panel responsive rules remain global,
  preserving advanced Sound Designer and generic component behavior.
- Manifest guards require exactly one deferred SoundTab CSS asset, prohibit its identifying
  selectors in initial CSS, and fail if any static route closure contains that asset.

### Batch 23 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 63/63 pass.
- Deterministic visual workload after activation: 92.62% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -18 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 24 — Home-owned recovery and shortcut CSS

Collected from component import reachability, generated selector ownership, all-route CSS closures,
the full suite, and isolated audio/visual gates.

| Metric | Batch 23 | Batch 24 | Change |
|---|---:|---:|---:|
| Initial/global CSS raw | 30.87 KiB | 25.68 KiB | -16.8% |
| Initial/global CSS gzip | 6.49 KiB | 5.63 KiB | -13.3% |
| Home overlay/recovery CSS | global | 3.06 KiB / 1.00 KiB gzip | Home-owned |
| Retired command/brand selector occurrences | 19 | 0 | removed |
| Home critical CSS gzip | 11.52 KiB | 11.66 KiB | +0.14 KiB split cost |
| Song Study critical CSS gzip | 13.15 KiB | 12.29 KiB | -6.5% |
| Sound Designer critical CSS gzip | 13.25 KiB | 12.39 KiB | -6.5% |
| Max passive-route critical CSS gzip | 11.67 KiB | 10.81 KiB | -7.4% |
| Total production CSS raw | 106.72 KiB | 104.59 KiB | -2.0% |
| Total production CSS gzip | 25.47 KiB | 25.60 KiB | +0.5% split compression cost |
| Production deployment bytes | 1,491.21 KiB | 1,489.15 KiB | -2.06 KiB |
| Automated production budgets | 63 | 66 | +3 guardrails |

Implemented boundaries and controls:

- The overlay stylesheet combined Home's live shortcut dialog and error recovery with command-
  palette and brand-kit selectors whose components have no import path in the application.
- Removed 19 retired command/brand selector occurrences and their unused animation keyframes.
- App now owns the remaining shortcut and ErrorBoundary CSS, including the compact shortcut grid
  and Gruvbox `!important` overrides. The Home lazy route receives these rules before it renders;
  the bootstrap shell and seven non-Home route closures no longer include them.
- The tradeoff is narrow and explicit: Home pays 0.14 KiB gzip of split overhead while every other
  route saves roughly 0.84–0.86 KiB gzip, and total raw CSS plus deployment size decrease.
- Generated-selector guards require one Home overlay asset, require it on Home and no other static
  route, prohibit its selectors in initial CSS, and require zero retired command/brand selectors.

### Batch 24 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 66/66 pass.
- Deterministic visual workload after activation: 92.45% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -40 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.9 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 23 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 25 — production-reachable CSS census

Collected from production JSX/class reachability across nine owned stylesheets, generated asset
sizes, all-route CSS closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 24 | Batch 25 | Change |
|---|---:|---:|---:|
| Audited owned CSS files | 0 | 9 | durable census |
| Audited owned CSS classes | untracked | 156 | guarded |
| Unreferenced audited classes | 18 families found | 0 | removed |
| Initial/global CSS raw | 25.68 KiB | 24.59 KiB | -4.2% |
| Initial/global CSS gzip | 5.63 KiB | 5.46 KiB | -3.0% |
| Keyboard CSS raw / gzip | 7.28 / 2.00 KiB | 5.63 / 1.71 KiB | -22.7% / -14.5% |
| SoundTab CSS raw / gzip | 6.34 / 1.52 KiB | 5.68 / 1.39 KiB | -10.4% / -8.6% |
| WaveCandy CSS raw / gzip | 1.85 / 0.78 KiB | 1.08 / 0.49 KiB | -41.6% / -37.2% |
| Home critical CSS gzip | 11.66 KiB | 11.19 KiB | -4.0% |
| Song / Designer critical CSS gzip | 12.29 / 12.39 KiB | 11.83 / 11.93 KiB | -3.7% |
| Total production CSS raw | 104.59 KiB | 100.42 KiB | -4.0% |
| Total production CSS gzip | 25.60 KiB | 24.73 KiB | -3.4% |
| Production deployment bytes | 1,489.15 KiB | 1,484.98 KiB | -4.17 KiB |
| Automated production budgets | 66 | 67 | +1 guardrail |

Implemented boundaries and controls:

- Cross-referenced literal production class usage against the global foundation plus owned Home,
  keyboard, SoundTab, WaveCandy, and radar styles. Tests do not count as production reachability.
- Removed retired layout tiers/zones/subtitles, a dead control chip and fieldset abstraction,
  unused control-surface/panel/row/footer layouts, obsolete keyboard header/legend/loading/hints,
  and the retired Raylib WaveCandy gear/viewport/canvas rules.
- Moved the final live waveform-button Gruvbox overrides out of global theme CSS and into SoundTab.
  The generated Sound panel keeps the same final `!important` colors while unrelated routes no
  longer parse those selectors. Removed the retired Raylib canvas selector from the theme group.
- The production guard now scans 156 classes across nine explicitly owned CSS files and fails if
  any loses its production JSX reference. Route CSS with intentional runtime-generated modifier
  names remains outside this literal-only census.

### Batch 25 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 67/67 pass.
- Deterministic visual workload after activation: 92.84% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.6 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, down by one retired chip selector.
- `git diff --check`: pass.

## Optimization batch 26 — full-source CSS reachability

Collected from production JSX/class reachability across every source stylesheet, generated asset
sizes, all-route CSS closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 25 | Batch 26 | Change |
|---|---:|---:|---:|
| Audited CSS files | 9 | 19 | complete source coverage |
| Audited CSS classes | 156 | 466 | +310 guarded classes |
| Unexplained unreferenced classes | 15 retired families | 0 | removed |
| Explicit runtime-composed modifiers | untracked | 12 | allowlisted and counted |
| Song Study critical CSS raw / gzip | 48.97 / 11.83 KiB | 48.46 / 11.77 KiB | -1.0% / -0.5% |
| Study Songs critical CSS raw / gzip | 42.92 / 9.87 KiB | 41.14 / 9.56 KiB | -4.1% / -3.1% |
| Voice Loop critical CSS raw / gzip | 45.94 / 10.58 KiB | 44.54 / 10.32 KiB | -3.0% / -2.5% |
| Total production CSS raw | 100.42 KiB | 96.72 KiB | -3.7% |
| Total production CSS gzip | 24.73 KiB | 24.09 KiB | -2.6% |
| Production deployment bytes | 1,484.98 KiB | 1,481.28 KiB | -3.70 KiB |
| Automated production budgets | 67 | 67 | existing guard widened |

Implemented boundaries and controls:

- Extended the production selector census from nine explicitly owned global/component files to
  all 19 CSS files under `src`, including every route and the control-kit surface.
- Added a narrow, reported allowlist for 12 modifier classes assembled from runtime values: eight
  control-kit size/orientation/alignment variants and four Voice Loop status tones. Everything
  else must appear literally in production JS/JSX or the build fails.
- Removed retired Song Study navigation rules, the superseded Study Songs flow/choice/create UI,
  and unused Voice Loop phrase/chord/piano/bar-marker presentations. The current route markup and
  runtime-composed status styling remain unchanged.
- The critical initial stylesheet is byte-for-byte unchanged; only route-owned payloads and total
  deployment size decrease.

### Batch 26 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 67/67 pass.
- Deterministic visual workload after activation: 90.94% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 27 — zero-request typography startup

Collected from document network hints, source font attribution, generated HTML/CSS sizes, the full
suite, and isolated audio/visual gates.

| Metric | Batch 26 | Batch 27 | Change |
|---|---:|---:|---:|
| Render-blocking external stylesheets | 1 | 0 | removed |
| Third-party preconnects | 2 | 0 | removed |
| Third-party font origins on startup | 2 | 0 | removed |
| Webfont swap/layout-shift opportunities | 1 family / 3 weights | 0 | removed |
| HTML raw | 0.96 KiB | 0.75 KiB | -21.9% |
| HTML gzip | 0.48 KiB | 0.42 KiB | -12.5% |
| Initial CSS raw / gzip | 24.59 / 5.46 KiB | 24.70 / 5.51 KiB | +0.11 / +0.05 KiB |
| Production deployment bytes | 1,481.28 KiB | 1,481.17 KiB | -0.11 KiB |
| Automated production budgets | 67 | 68 | +1 guardrail |

Implemented boundaries and controls:

- Removed the render-blocking Google Fonts stylesheet and both Google Fonts preconnects. Startup
  no longer depends on DNS, TLS, CSS, or font responses from a third-party origin.
- Centralized the existing native monospace fallbacks as one `--font-mono` token and applied it to
  the document, control kit, error readout, and canvas labels. No font binary is added to the
  deployment, cache, or memory footprint.
- Added a tiny inline document background matching the final Gruvbox ink surface and aligned the
  browser theme color, preventing a light first-paint flash before the local stylesheet arrives.
- The native stack adds 0.05 KiB gzip to shared CSS, but removes three cross-origin startup hints
  and the late webfont swap. A production guard now fails on any external critical stylesheet or
  preconnect reintroduced into the document.

### Batch 27 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 68/68 pass.
- Deterministic visual workload after activation: 90.71% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 28 — inert worker and orphan public assets

Collected from complete public-file attribution, production service-worker registration scans,
generated bundle closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 27 | Batch 28 | Change |
|---|---:|---:|---:|
| Public files | 82 | 79 | -3 orphan/inert files |
| Public static bytes | 860.05 KiB | 856.13 KiB | -3.92 KiB |
| Production deployment bytes | 1,481.17 KiB | 1,477.73 KiB | -3.44 KiB |
| Production service-worker registrations | 1 | 0 | removed |
| Post-load worker request/lifecycle task | 1 | 0 | removed |
| Static event-listener sites | 32 | 31 | -1 |
| Initial JS raw / gzip | 145.24 / 47.25 KiB | 144.96 / 47.13 KiB | -0.28 / -0.12 KiB |
| Total JS asset count | 44 | 45 | +1 tiny shared helper chunk |
| Automated production budgets | 68 | 69 | +1 guardrail |

Implemented boundaries and controls:

- Attributed all remaining public files: 78 selectable MIDI files are generated into the built-in
  library, and the favicon is linked by the document. Removed two unreferenced legacy synthwave
  texture SVGs.
- Removed the production service-worker registration and its 442-byte worker. The worker had no
  fetch handler or offline/cache delivery path; it created a post-load request and lifecycle work
  solely to delete old caches.
- Dropped the bootstrap's now-unused base-URL import. Vite keeps the 0.19 KiB gzip helper as a
  shared deferred chunk for the four data-oriented routes that actually use it, saving 0.12 KiB
  gzip on every initial load at the cost of one tiny cached request on those secondary routes.
- A production guard now fails if the retired worker/textures or any service-worker registration
  reappears. Fresh installs have no worker lifecycle work; previously installed inert workers have
  no fetch handler and therefore do not intercept application requests.

### Batch 28 verification gates

- Full suite: 48 files, 492/492 tests pass.
- Production delivery/static/dependency/route guardrails: 69/69 pass.
- Deterministic visual workload after activation: 90.85% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 415.7 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 29 — intent-driven sidebar work

Collected from sidebar event-lifecycle inspection, Vite route closures, focused interaction tests,
the full suite, and isolated audio/visual gates.

| Metric | Batch 28 | Batch 29 | Change |
|---|---:|---:|---:|
| Collapsed-sidebar Escape listeners | 1 | 0 | removed from idle state |
| Intent-prefetched route destinations | 0 | 2 | Home + Sound Designer |
| Pointer/keyboard intent bindings | 0 | 4 | pointer-enter + focus |
| Initial JS raw / gzip | 144.96 / 47.13 KiB | 144.96 / 47.13 KiB | unchanged |
| Shared rail JS raw / gzip | 2.57 / 0.99 KiB | 3.43 / 1.38 KiB | +0.86 / +0.39 KiB |
| Max static-route JS gzip | 67.42 KiB | 67.81 KiB | +0.39 KiB |
| Production deployment bytes | 1,477.73 KiB | 1,478.69 KiB | +0.96 KiB |
| Automated production budgets | 69 | 70 | +1 guardrail |

Implemented boundaries and controls:

- The sidebar now attaches its global Escape listener only while an enabled panel is open. The
  collapsed default state has no listener or keydown callback work; cleanup still occurs on close,
  disable, or unmount.
- Home and Sound Designer navigation links begin their existing lazy route imports on pointer
  intent or keyboard focus. No route bytes move into the startup path and no speculative request
  occurs without user intent; repeated intent reuses a module-scoped promise.
- The tradeoff is explicit: the shared rail gains 0.39 KiB gzip, paid only on routes that render
  the rail, to hide route-fetch latency between intent and click. Initial document/bootstrap bytes
  remain unchanged.
- Added a collapsed-Escape regression test plus a production guard requiring both dynamic route
  imports, all four intent bindings, and the open-only Escape lifecycle.

### Batch 29 verification gates

- Full suite: 48 files, 493/493 tests pass.
- Production delivery/static/dependency/route guardrails: 70/70 pass.
- Deterministic visual workload after activation: 90.38% lower CPU time, 78.18% fewer analyser
  samples, and 65.71% fewer resample samples than the legacy reference; exact counts are unchanged.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -18 KB over 4,000 blocks.
- Isolated DSP benchmark: 415.2 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 30 — adaptive WebGL scene cadence

Collected from production frame-loop inspection, a shared frame-policy benchmark, generated route
closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 29 | Batch 30 | Change |
|---|---:|---:|---:|
| Active WebGL scene draws over 20 s | 1,200 | 600 | -50.0% |
| Silent WebGL scene draws over 20 s | 1,200 | 400 | -66.7% |
| Active scene band evaluations over 20 s | 13,200 | 6,600 | -50.0% |
| Hidden-tab scene cadence | 0 Hz | 0 Hz | preserved |
| Reduced-motion scene cadence | 0 Hz | 0 Hz | preserved |
| Initial Home JS raw / gzip | 203.05 / 67.81 KiB | 203.05 / 67.81 KiB | unchanged |
| Deferred Scene JS raw / gzip | 9.60 / 4.37 KiB | 9.69 / 4.42 KiB | +0.09 / +0.05 KiB |
| Production deployment bytes | 1,478.69 KiB | 1,478.77 KiB | +0.08 KiB |
| Automated production budgets | 70 | 71 | +1 guardrail |

Implemented boundaries and controls:

- Replaced the full-refresh-rate WebGL draw policy with a shared adaptive policy: 30 Hz while
  audio, transient decay, or vortex particles are active, and 20 Hz for the slow silent ambient
  motion. The shader remains visually continuous while full-screen GPU submissions drop sharply.
- Frame timestamps now come from the RAF callback instead of an extra `performance.now()` call.
  The existing visibility-aware loop still cancels hidden-tab work, and the pre-existing reduced-
  motion check still avoids creating the WebGL context entirely.
- The deterministic visual benchmark imports the same production constants and now measures scene
  frames plus all 11 spectral-band evaluations alongside analyzer/radar work. This prevents the
  benchmark cadence from drifting away from production behavior.
- Added two unit tests for active/idle policy selection and a production budget requiring active
  cadence at or below 30 Hz and idle cadence at or below 20 Hz.

### Batch 30 verification gates

- Full suite: 49 files, 495/495 tests pass.
- Production delivery/static/dependency/route guardrails: 71/71 pass.
- Deterministic combined visual workload: 88.57% lower CPU time than the legacy reference, with
  78.18% fewer analyser samples, 65.71% fewer resample samples, and 50% fewer active scene frames
  and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 414.6 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 31 — graph-gated analyzer loop

Collected from audio gateway/status semantics, WaveCandy frame-loop inspection, generated visual
closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 30 | Batch 31 | Change |
|---|---:|---:|---:|
| Cold analyzer render attempts over 20 s | ~600 | 0 | removed |
| Cold analyzer frame cadence | ~30 Hz | 0 Hz | status-gated |
| Hidden-tab analyzer cadence | 0 Hz | 0 Hz | preserved |
| Active analyzer cadence | ~30 Hz | ~30 Hz | preserved |
| Initial Home JS raw / gzip | 203.05 / 67.81 KiB | 203.05 / 67.81 KiB | unchanged |
| Fully activated Home visual JS gzip | 76.98 KiB | 77.04 KiB | +0.06 KiB |
| Deferred WaveCandy JS raw / gzip | 8.03 / 3.04 KiB | 8.13 / 3.10 KiB | +0.10 / +0.06 KiB |
| Production deployment bytes | 1,478.77 KiB | 1,478.87 KiB | +0.10 KiB |
| Automated production budgets | 71 | 72 | +1 guardrail |

Implemented boundaries and controls:

- WaveCandy no longer starts a visibility-aware RAF loop immediately after its deferred component
  mount. It first checks for live analysis nodes, then subscribes to the lightweight engine status
  channel and starts exactly once when the audio graph publishes readiness.
- A cold page therefore has no analyzer RAF callbacks, repeated graph lookups, buffer checks, or
  canvas draws. If the graph already exists when WaveCandy mounts, the synchronous readiness check
  starts it immediately; later graph creation is caught by the status subscription.
- Cleanup now removes both the status subscription and an active frame loop. Existing 30 Hz draw
  throttling and hidden-tab cancellation remain unchanged after activation.
- Added reported cold-frame cadence plus a production guard requiring the graph-gated start; the
  critical Home and Sound Designer route closures remain unchanged.

### Batch 31 verification gates

- Full suite: 49 files, 495/495 tests pass.
- Production delivery/static/dependency/route guardrails: 72/72 pass.
- Deterministic combined visual workload: 88.55% lower CPU time than the legacy reference, with
  78.18% fewer analyser samples, 65.71% fewer resample samples, and 50% fewer active scene frames
  and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.8 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 32 — graph-gated analyzer resources

Collected from analyzer mount/resource ordering, canvas controller behavior, generated visual
closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 31 | Batch 32 | Change |
|---|---:|---:|---:|
| Cold analyzer 2D contexts | 5 | 0 | graph-gated |
| Cold analyzer resize observers | 5 | 0 | graph-gated |
| Cold analyzer frame cadence | 0 Hz | 0 Hz | preserved |
| Active analyzer contexts / observers | 5 / 5 | 5 / 5 | preserved |
| Initial Home JS raw / gzip | 203.05 / 67.81 KiB | 203.05 / 67.81 KiB | unchanged |
| Fully activated Home visual JS gzip | 77.04 KiB | 77.04 KiB | unchanged |
| Production deployment bytes | 1,478.87 KiB | 1,478.86 KiB | effectively flat |
| Automated production budgets | 72 | 73 | +1 guardrail |

Implemented boundaries and controls:

- Moved all five WaveCandy `getContext('2d')` calls and canvas size-controller constructions
  inside the graph-readiness boundary introduced in Batch 31. The deferred visualizer shell now
  costs only its stable DOM/CSS until audio is actually initialized.
- When graph readiness arrives, contexts and resize observers initialize immediately before the
  existing visibility-aware frame loop, so active rendering behavior and sizing remain unchanged.
- Cleanup safely handles both cold/uninitialized and active states, disconnecting only resources
  that were created.
- Added reported cold context/observer counts and a source-order production guard. Updated the
  Sound Designer audio-engine test double to expose the real gateway's cold
  `getAnalysisNodes() -> null` contract, eliminating timing-sensitive mock behavior.

### Batch 32 verification gates

- Full suite: 49 files, 495/495 tests pass, including two repeated focused Sound Designer runs
  after correcting the cold gateway mock.
- Production delivery/static/dependency/route guardrails: 73/73 pass.
- Deterministic combined visual workload: 83.75% lower CPU time than the legacy reference, with
  78.18% fewer analyser samples, 65.71% fewer resample samples, and 50% fewer active scene frames
  and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias
  thresholds pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.3 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 33 — compact stereo analyzer windows

Collected from the live audio graph configuration, WaveCandy sampling loops, generated production
closures, the deterministic visual workload, the full suite, and isolated audio/visual gates.

| Metric | Batch 32 | Batch 33 | Change |
|---|---:|---:|---:|
| Active analyzer samples per frame | 5,632 | 3,584 | -36.36% |
| Active analyzer samples over 20 s | 3,379,200 | 2,150,400 | -36.36% |
| Stereo pair evaluations over 20 s | 1,843,200 | 921,600 | -50.00% |
| Mono FFT / scope window | 1,024 | 1,024 | unchanged |
| Active analyzer cadence | 30 Hz | 30 Hz | unchanged |
| Initial Home JS raw / gzip | 203.05 / 67.81 KiB | 203.05 / 67.81 KiB | unchanged |
| Fully activated Home visual JS gzip | 77.04 KiB | 77.07 KiB | +0.03 KiB |
| Production deployment bytes | 1,478.86 KiB | 1,478.97 KiB | +0.11 KiB |
| Automated production budgets | 73 | 74 | +1 guardrail |

Implemented boundaries and controls:

- Reduced the left and right stereo analyzer FFT windows from 2,048 to 1,024 samples. The compact
  meters and goniometer retain sufficient temporal detail while avoiding half of their former
  per-channel buffer reads; the mono spectrum and oscilloscope remain at 1,024.
- Centralized analyzer FFT sizes and the 30 Hz WaveCandy cadence in shared policy modules consumed
  by the graph, renderer, visual benchmark, and production metrics script. Reported workload now
  derives from the same constants that configure runtime behavior rather than duplicated literals.
- Added exact sample-volume reporting and a production guard requiring both active mono and stereo
  FFT windows to remain at or below 1,024 samples. Added focused policy tests for the configured
  windows and derived 3,584-sample frame budget.
- Audio processing topology and sound output are unchanged: only the read-only visualization taps
  use smaller stereo analysis windows.

### Batch 33 verification gates

- Full suite: 50 files, 497/497 tests pass.
- Production delivery/static/dependency/route guardrails: 74/74 pass.
- Deterministic combined visual workload: 86.92% lower CPU time than the legacy reference, with
  36.36% fewer active analyzer samples and 50% fewer stereo pair evaluations than Batch 32,
  alongside the existing 50% scene-frame and scene-band reductions.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 404.6 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 34 — merged stereo visual traversal

Collected from the WaveCandy meter and goniometer loops, an isolated 20,000-iteration stereo
traversal profile, exact active-frame operation counts, generated production closures, the full
suite, and isolated audio/visual gates. This batch also corrects Batch 33's reported pair-evaluation
totals: its percentage reduction was correct, but the totals had omitted the goniometer traversal.

| Metric | Batch 33 | Batch 34 | Change |
|---|---:|---:|---:|
| Stereo pair evaluations per active frame | 1,536 | 512 | -66.67% |
| Stereo pair evaluations over 20 s | 921,600 | 307,200 | -66.67% |
| Isolated stereo traversal CPU, 20k iterations | 34.16 ms | 21.50 ms | -37.07% |
| Active analyzer samples per frame | 3,584 | 3,584 | unchanged |
| Active analyzer cadence | 30 Hz | 30 Hz | unchanged |
| Initial Home JS gzip | 67.81 KiB | 67.85 KiB | +0.04 KiB |
| Fully activated Home visual JS gzip | 77.07 KiB | 77.19 KiB | +0.12 KiB |
| Production deployment bytes | 1,478.97 KiB | 1,479.46 KiB | +0.49 KiB |
| Automated production budgets | 74 | 75 | +1 guardrail |

Implemented boundaries and controls:

- Folded short-term mean-square and peak collection into the goniometer's existing stride-two
  stereo traversal. The meter no longer performs its own full 1,024-pair walk before the same
  channels are visited for visualization.
- Retained 512 sampled pairs per frame—more than the compact visual surface can display—while
  preserving the existing 400 ms loudness smoothing, 1.5 s peak hold, FFT sizes, analyzer reads,
  graph topology, and 30 Hz cadence.
- Reused a stable stereo-statistics object across frames so the merged hot path does not introduce
  transient result allocations or additional garbage-collection pressure.
- Added shared stride and exact pair-evaluation policy metrics, a focused policy test, a dedicated
  isolated traversal benchmark, and a production guard capped at 512 shared pairs per frame.

### Batch 34 verification gates

- Full suite: 50 files, 498/498 tests pass.
- Production delivery/static/dependency/route guardrails: 75/75 pass.
- Isolated stereo traversal profile: 34.16 ms to 21.50 ms over 20,000 iterations, a 37.07%
  measured CPU-time reduction; exact runtime pair evaluations fall 66.67% from Batch 33 and 83.33%
  cumulatively from the original 2,048-sample stereo policy.
- Deterministic combined visual workload: 87.25% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 402.1 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 35 — resize-scoped canvas gradients

Collected from Canvas 2D allocation-site inspection, the WaveCandy active-frame policy, exact
20-second allocation counts, generated production closures, the full suite, and isolated
audio/visual gates.

| Metric | Batch 34 | Batch 35 | Change |
|---|---:|---:|---:|
| Analyzer gradient creations over 20 s | 1,200 | 2 | -99.83% |
| Steady-state gradient allocations per frame | 2 | 0 | removed |
| Active analyzer frames over 20 s | 600 | 600 | unchanged |
| Initial Home JS gzip | 67.85 KiB | 67.86 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 77.19 KiB | 77.24 KiB | +0.05 KiB |
| Production deployment bytes | 1,479.46 KiB | 1,479.60 KiB | +0.14 KiB |
| Automated production budgets | 75 | 76 | +1 guardrail |

Implemented boundaries and controls:

- Cached the spectrum fill and loudness-meter gradients after their first creation. Canvas
  gradients depend on the target height, so each cache is invalidated and rebuilt only when its
  canvas size controller reports a resize.
- Removed both native gradient allocations from the 30 Hz steady-state render path without
  changing colors, stops, draw order, compositing, analyzer sampling, or audio behavior.
- Added exact 20-second allocation reporting and a production source guard that requires every
  analyzer gradient creation site to be protected by a resize-scoped cache.

### Batch 35 verification gates

- Full suite: 50 files, 498/498 tests pass, including 20/20 focused Sound Designer tests.
- Production delivery/static/dependency/route guardrails: 76/76 pass.
- Analyzer gradient policy: 1,200 to 2 native objects over 20 seconds, a 99.83% reduction, with
  zero steady-state gradient allocations per frame.
- Isolated stereo traversal profile remains 36.96% faster than Batch 33; exact pair work remains
  66.67% below Batch 33 and 83.33% below the original stereo policy.
- Deterministic combined visual workload: 88.44% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 404.2 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 36 — configuration-scoped spectrum bins

Collected from the log-spectrum sampler, an isolated 20,000-iteration equivalence workload,
exact active-frame transcendental-operation counts, generated production closures, the full suite,
and isolated audio/visual gates.

| Metric | Batch 35 | Batch 36 | Change |
|---|---:|---:|---:|
| Log-frequency boundary evaluations over 20 s | 115,200 | 192 | -99.83% |
| Steady-state boundary evaluations per frame | 192 | 0 | removed |
| Isolated spectrum sampler CPU, 20k iterations | 30.77 ms | 7.45 ms | -75.79% |
| Initial Home JS gzip | 67.86 KiB | 67.85 KiB | -0.01 KiB |
| Fully activated Home visual JS gzip | 77.24 KiB | 77.38 KiB | +0.14 KiB |
| Production deployment bytes | 1,479.60 KiB | 1,480.10 KiB | +0.50 KiB |
| Automated production budgets | 76 | 77 | +1 guardrail |

Implemented boundaries and controls:

- Moved the 96-cell log-frequency boundary map out of the 30 Hz sampling loop. The renderer now
  computes 192 lower/upper bin boundaries once and reuses them until sample rate, FFT size, or
  frequency-bin count changes.
- Kept peak-preserving bin selection, byte-to-decibel conversion, and the existing fast-attack /
  slow-release ballistics unchanged; the optimization removes only repeated invariant `Math.pow`,
  division, floor/ceil, and clamp work.
- Extracted the range builder and sampler into a focused utility with tests for ordered/clamped
  ranges and exact attack/release behavior. Added an isolated legacy-vs-cached sampler profile and
  a production source guard requiring configuration-scoped range reuse.

### Batch 36 verification gates

- Full suite: 51 files, 500/500 tests pass, including the new spectrum-equivalence cases and 20/20
  focused Sound Designer tests.
- Production delivery/static/dependency/route guardrails: 77/77 pass.
- Isolated spectrum sampler profile: 30.77 ms to 7.45 ms over 20,000 iterations, a 75.79% measured
  CPU-time reduction; exact boundary evaluations fall 99.83% over a 20-second active session.
- Analyzer gradient allocations remain 99.83% below Batch 34 with zero steady-state allocations;
  stereo pair work remains 83.33% below the original policy.
- Deterministic combined visual workload: 86.19% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -23 KB over 4,000 blocks.
- Isolated DSP benchmark: 400.5 us per 128-frame block with 6.7x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 37 — cached spectrogram rows and palette

Collected from the 150-pixel desktop spectrogram column renderer, exact 20-second allocation and
draw-call counts, an isolated 20,000-column workload, row-coverage equivalence tests, generated
production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 36 | Batch 37 | Change |
|---|---:|---:|---:|
| Spectrogram color strings over 20 s | 90,000 | 256 | -99.72% |
| Steady-state color-string allocations per frame | 150 | 0 | removed |
| Spectrogram column fill calls over 20 s | 90,000 | 57,600 | -36.00% |
| Isolated column renderer CPU, 20k iterations | 85.56 ms | 2.49 ms | -97.09% |
| Initial Home JS gzip | 67.85 KiB | 67.86 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 77.38 KiB | 77.60 KiB | +0.22 KiB |
| Production deployment bytes | 1,480.10 KiB | 1,480.57 KiB | +0.47 KiB |
| Automated production budgets | 77 | 78 | +1 guardrail |

Implemented boundaries and controls:

- Replaced per-pixel HSL template formatting with a deferred 256-entry ember-to-amber lookup
  table. The palette is created only when the graph-backed visualizer first renders, then reused
  without steady-state string allocation.
- Precomputed contiguous canvas row spans for the 96 spectrum cells whenever the spectrogram
  height or cell count changes. Each frame now paints at most 96 vertical runs instead of 150
  individual pixels on the desktop tile.
- Preserved the original frequency-cell mapping exactly: focused coverage tests prove every one of
  the 150 rows is painted once and maps to the same reversed source cell as the previous loop.
  Palette quantization is limited to 256 levels, exceeding the tile's vertical resolution.
- Added an isolated legacy-vs-cached column profile and a production guard requiring both the row
  map and palette to remain configuration-scoped.

### Batch 37 verification gates

- Full suite: 52 files, 502/502 tests pass, including row-coverage/palette cases and 20/20 focused
  Sound Designer tests.
- Production delivery/static/dependency/route guardrails: 78/78 pass.
- Isolated spectrogram column profile: 85.56 ms to 2.49 ms over 20,000 iterations, a 97.09%
  measured CPU-time reduction; steady-state color-string allocations are eliminated and fill calls
  fall 36% over the desktop workload.
- Spectrum boundary evaluations and canvas gradient allocations remain 99.83% below their
  respective baselines; stereo pair work remains 83.33% below the original policy.
- Deterministic combined visual workload: 87.12% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 404.7 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 38 — bounded radar palette cache

Collected from the MIDI birds-eye note loop, exact 20-second render-window counts, an isolated
200,000-lookup palette workload, endpoint-color equivalence tests, generated production closures,
the full suite, and isolated audio/visual gates.

| Metric | Batch 37 | Batch 38 | Change |
|---|---:|---:|---:|
| Radar palette constructions over 20 s | 104,000 | <=256 | -99.75% or better |
| Steady-state palette constructions per note | 1 | 0 | removed |
| Isolated palette workload, 200k calls | 13.60 ms | 3.89 ms | -71.35% |
| Deferred BirdsEyeRadar JS raw / gzip | 6.28 / 2.74 KiB | 6.35 / 2.79 KiB | +0.07 / +0.05 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.86 KiB | unchanged |
| Production deployment bytes | 1,480.57 KiB | 1,480.64 KiB | +0.07 KiB |
| Automated production budgets | 78 | 79 | +1 guardrail |

Implemented boundaries and controls:

- Replaced per-note palette reconstruction with a module-local numeric-key cache. MIDI is clamped
  to 0–127 and combined with the active flag, bounding the cache to 256 reusable states without
  allocating string keys.
- Removed two temporary RGB arrays, four RGBA template strings, interpolation arithmetic, and a
  palette object from every visible-note evaluation after each state is first encountered.
- Preserved the exact blue-to-orange interpolation and active/inactive alpha values. Focused tests
  verify endpoint colors, active-state separation, same-state reference reuse, and the state bound.
- Added exact construction-volume reporting, an isolated legacy-vs-cached palette profile, and a
  production source guard requiring the numeric-key cache on the radar render path.

### Batch 38 verification gates

- Full suite: 53 files, 504/504 tests pass, including palette identity/color cases and focused MIDI
  birds-eye and Song Study tests.
- Production delivery/static/dependency/route guardrails: 79/79 pass.
- Isolated radar palette profile: 13.60 ms to 3.89 ms over 200,000 calls, a 71.35% measured CPU-time
  reduction; constructions fall at least 99.75% over the 20-second note-window workload.
- Spectrogram color-string work remains 99.72% below its baseline, spectrum boundary/gradient
  allocation work remains 99.83% lower, and stereo pair work remains 83.33% lower.
- Deterministic combined visual workload: 87.35% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 403.5 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 39 — resize-scoped radar gradients

Collected from the radar backdrop/grid draw path, exact 25 Hz playing-cadence allocation counts,
mocked Canvas gradient identity tests, generated production closures, the full suite, and isolated
audio/visual gates.

| Metric | Batch 38 | Batch 39 | Change |
|---|---:|---:|---:|
| Static radar gradients over 20 s playing | 2,000 | 4 | -99.80% |
| All backdrop/grid gradients over 20 s | 2,500 | 504 | -79.84% |
| Static gradient creations per steady-state frame | 4 | 0 | removed |
| Deferred BirdsEyeRadar JS raw / gzip | 6.35 / 2.79 KiB | 6.80 / 2.98 KiB | +0.45 / +0.19 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.86 KiB | unchanged |
| Production deployment bytes | 1,480.64 KiB | 1,481.08 KiB | +0.44 KiB |
| Automated production budgets | 79 | 80 | +1 guardrail |

Implemented boundaries and controls:

- Moved the base, horizon, canopy, and grid-horizon gradients into a cache keyed by canvas width
  and height. All four native objects are created on the first draw and rebuilt only after a real
  dimension change.
- Kept the horizontal sweep gradient frame-local because its coordinates animate with playback and
  time. Per-note trail/body gradients also remain dynamic; the cache removes only geometry-invariant
  work and preserves the radar's visual treatment exactly.
- Began acknowledging the canvas size controller after each completed radar frame, keeping its
  resize lifecycle accurate for this and future resize-scoped resources.
- Added mocked Canvas tests proving same-size identity reuse and four-object invalidation after a
  resize, plus exact playing-session allocation metrics and a production source guard.

### Batch 39 verification gates

- Full suite: 54 files, 505/505 tests pass, including static-gradient cache identity/invalidation
  and the focused radar/Song Study cases.
- Production delivery/static/dependency/route guardrails: 80/80 pass.
- Radar static gradient creation falls 99.80% over 20 seconds; total backdrop/grid gradient creation
  falls 79.84% while the animated sweep remains unchanged.
- Radar palette construction remains at least 99.75% lower, spectrogram string work 99.72% lower,
  analyzer invariant work 99.83% lower, and stereo pair work 83.33% lower than their baselines.
- Deterministic combined visual workload: 86.47% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -22 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.5 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 40 — bounded radar particle colors

Collected from the 32-particle radar loop, exact 25 Hz playing-session string counts, an isolated
200,000-conversion workload, three-decimal color equivalence tests, generated production closures,
the full suite, and isolated audio/visual gates.

| Metric | Batch 39 | Batch 40 | Change |
|---|---:|---:|---:|
| Particle RGBA strings over 20 s playing | 16,000 | 121 | -99.24% |
| Steady-state particle color strings per frame | 32 | 0 | removed |
| Isolated particle-color workload, 200k calls | 8.95 ms | 1.33 ms | -85.14% |
| Deferred BirdsEyeRadar JS raw / gzip | 6.80 / 2.98 KiB | 6.93 / 3.05 KiB | +0.13 / +0.07 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.85 KiB | -0.01 KiB |
| Production deployment bytes | 1,481.08 KiB | 1,481.21 KiB | +0.13 KiB |
| Automated production budgets | 80 | 81 | +1 guardrail |

Implemented boundaries and controls:

- Replaced each particle's per-frame `alpha.toFixed(3)` and RGBA template construction with a
  121-entry lookup table covering the exact 0.015–0.135 alpha range at three-decimal precision.
- The hot path now performs a numeric multiply/round/clamp and array lookup; the table is created
  once when the already-deferred radar chunk loads and has a fixed, documented upper bound.
- Added focused endpoint, quantization, and clamp tests, an isolated legacy-vs-cached conversion
  profile, exact playing-session string counts, and a production source guard.

### Batch 40 verification gates

- Full suite: 55 files, 507/507 tests pass, including particle-color equivalence and all focused
  radar/Song Study cases.
- Production delivery/static/dependency/route guardrails: 81/81 pass.
- Isolated particle-color profile: 8.95 ms to 1.33 ms over 200,000 calls, an 85.14% measured CPU-time
  reduction; formatted color strings fall 99.24% over a 20-second playing session.
- Radar static gradients remain 99.80% lower and note palettes at least 99.75% lower; spectrogram,
  spectrum, analyzer-allocation, and stereo traversal reductions remain intact.
- Deterministic combined visual workload: 87.59% lower measured CPU time than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 403.4 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 41 — configuration-scoped WebGL scene bands

Collected from the WebGL scene's 11-band analyser path, exact 20-second boundary-operation
counts, an isolated 20,000-frame equivalence workload, warmed normalized-median visual scenarios,
generated production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 40 | Batch 41 | Change |
|---|---:|---:|---:|
| Scene frequency-boundary evaluations over 20 s active | 13,200 | 22 | -99.83% |
| Scene boundary evaluations per steady-state frame | 22 | 0 | removed |
| Isolated scene-band CPU, 20k frames (median of 3) | 6.56 ms | 3.09 ms | -52.96% |
| Normalized median combined visual CPU vs legacy | single cold sample | -80.41% | methodology hardened |
| Initial Home JS gzip | 67.85 KiB | 67.86 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 77.59 KiB | 77.86 KiB | +0.27 KiB |
| Production deployment bytes | 1,481.21 KiB | 1,481.92 KiB | +0.71 KiB |
| Automated production budgets | 81 | 82 | +1 guardrail |

Implemented boundaries and controls:

- Precomputed the inclusive FFT-bin ranges for all three scene envelopes and eight Fourier shader
  bands. The 30 Hz active path now reuses 22 compact boundaries until sample rate, FFT size, or
  frequency-bin count changes.
- Replaced 11 frame-local helper calls with one allocation-free sampler over a reusable
  double-precision output buffer. Exact-equality tests confirm every normalized energy matches the
  former calculation; smoothing, onset detection, vortex behavior, and shader uniforms are
  unchanged.
- Made analyser-buffer sizing configuration-aware so a future FFT-size change rebuilds both the
  byte buffer and range cache instead of retaining stale dimensions.
- Hardened the combined visual workload measurement: each scenario now warms for five samples and
  reports the median of 21 samples, each normalized across 25 equivalent 20-second workloads. This
  removes the JIT-skewed sub-millisecond cold sample used by earlier batches; the new combined CPU
  percentage is therefore a methodology reset rather than a comparison with Batch 40's percentage.
- Added focused boundary/equivalence tests, exact boundary-operation reporting, an isolated
  legacy-vs-cached scene profile, and a production guard requiring configuration-scoped reuse.

### Batch 41 verification gates

- Full suite: 56 files, 510/510 tests pass, including exact scene-band energy equivalence and all
  focused Sound Designer, radar, Song Study, canvas, and audio cases.
- Production delivery/static/dependency/route guardrails: 82/82 pass; the scene reports zero
  steady-state frequency-boundary evaluations.
- The median of three isolated scene-band profiles is 6.56 ms to 3.09 ms over 20,000 frames, a
  52.96% measured CPU-time reduction; individual reductions were 48.64–52.96%. Exact boundary
  calculations fall 99.83% over a 20-second active session.
- Three warmed combined-visual runs measured 80.17%, 80.41%, and 80.23% lower normalized median CPU
  than the legacy reference, with 78.18% fewer analyzer samples, 65.71% fewer resample samples,
  and 50% fewer scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and repeated saturated heap drift is -38 to -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.1 us per 128-frame block with 6.5x realtime headroom in the final
  pass (402.4 us and 6.6x in the preceding pass).
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 42 — allocation-free vortex frames

Collected from the WebGL scene's 12-particle saturation path, exact 20-second allocation counts,
four isolated 20,000-frame physics/uniform workloads, exact legacy-kernel equivalence tests,
generated production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 41 | Batch 42 | Change |
|---|---:|---:|---:|
| Vortex velocity objects over 20 s at capacity | 7,200 | 0 | removed |
| Vortex temporary arrays over 20 s at capacity | 2,400 | 0 | removed |
| Total vortex frame temporaries over 20 s | 9,600 | 0 | removed |
| Isolated vortex physics + uniform CPU, 20k frames | 21.97 ms | 16.66 ms | -24.15% |
| Shared visual policy/physics JS raw / gzip | 2.92 / 1.33 KiB | 3.49 / 1.53 KiB | +0.57 / +0.20 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.87 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 77.86 KiB | 78.07 KiB | +0.21 KiB |
| Production deployment bytes | 1,481.92 KiB | 1,482.48 KiB | +0.56 KiB |
| Automated production budgets | 82 | 83 | +1 guardrail |

Implemented boundaries and controls:

- Replaced the vortex step's per-particle `{u, v}` results and `map` output with two
  constructor-scoped `Float64Array` buffers. The mutual-advection loop retains the same source
  order and arithmetic, and a 30-frame exact-equivalence test matches the former kernel object for
  object and field for field.
- Compacted surviving particles into the existing array instead of replacing it with a filtered
  array every active frame. Particle order and eviction behavior remain unchanged.
- Replaced spread, native sort, and slice in uniform selection with a stable insertion sort over a
  fixed selection buffer. At the scene's 12-particle ceiling this removes two more arrays per frame
  while preserving strongest-first ordering, including equal-magnitude stability.
- Explicitly clears selection slots after culling so reusable storage cannot retain dead particle
  objects. Focused tests cover storage identity, stable ordering, culling, and reference release.
- Added exact saturated-session object/array counts, a legacy-vs-current full physics/uniform
  profile, and a production guard requiring allocation-free active vortex frames.

### Batch 42 verification gates

- Full suite: 56 files, 514/514 tests pass, including 18 vortex/numerical cases and all existing
  Sound Designer, radar, Song Study, canvas, and audio cases.
- Production delivery/static/dependency/route guardrails: 83/83 pass; the scene reports zero
  steady-state vortex velocity-object and temporary-array allocations.
- Four isolated 20,000-frame vortex profiles measured 23.34–25.98% lower CPU time; the final pass
  is 21.97 ms to 16.66 ms, a 24.15% reduction, with all 12 particles still active after the run.
- Warmed combined visual workload: 80.27% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -18 KB over 4,000 blocks.
- Isolated DSP benchmark: 409.5 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 43 — reusable Lagrange envelope plan

Collected from WaveCandy's 96-cell, 21-control-point spectrum envelope, exact active-session
allocation and setup-operation counts, three isolated 20,000-envelope workloads, Float32 output
identity tests, generated production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 42 | Batch 43 | Change |
|---|---:|---:|---:|
| Lagrange frame allocations over 20 s active | 2,400 | 0 | removed |
| Invariant weight products over 20 s active | 252,000 | 420 | -99.83% |
| Isolated envelope CPU, 20k frames | 43.22 ms | 17.80 ms | -58.82% |
| Shared visual policy/physics JS raw / gzip | 3.49 / 1.53 KiB | 3.97 / 1.73 KiB | +0.48 / +0.20 KiB |
| Deferred WaveCandy JS raw / gzip | 9.53 / 3.61 KiB | 9.65 / 3.66 KiB | +0.12 / +0.05 KiB |
| Initial Home JS gzip | 67.87 KiB | 67.86 KiB | -0.01 KiB |
| Fully activated Home visual JS gzip | 78.07 KiB | 78.30 KiB | +0.23 KiB |
| Production deployment bytes | 1,482.48 KiB | 1,483.06 KiB | +0.58 KiB |
| Automated production budgets | 83 | 84 | +1 guardrail |

Implemented boundaries and controls:

- Added a single-consumer interpolation plan that precomputes Chebyshev nodes, source indices,
  barycentric weights, output terms, exact-node identities, and denominators for WaveCandy's fixed
  96-by-21 envelope geometry.
- The 30 Hz frame path now refreshes only the 21 control values and evaluates the existing
  numerator products. It removes node/weight/control-array reconstruction and the frame-local
  interpolant closure while retaining the former multiplication order and final denominator
  division.
- Float32 identity tests prove every output cell exactly matches the allocating implementation,
  including exact-node endpoints. The plan's term and control buffers retain identity across
  repeated samples.
- Added exact allocation and invariant-weight reporting, a legacy-vs-planned envelope profile, and
  a production guard requiring one reusable plan per WaveCandy canvas.

### Batch 43 verification gates

- Full suite: 56 files, 515/515 tests pass, including 19 numerical/physics/interpolation cases and
  all existing Sound Designer, radar, Song Study, canvas, and audio cases.
- Production delivery/static/dependency/route guardrails: 84/84 pass; WaveCandy reports zero
  steady-state Lagrange-plan allocations.
- Three isolated 20,000-envelope profiles measured 56.86–59.08% lower CPU time; the final pass is
  43.22 ms to 17.80 ms, a 58.82% reduction. Invariant setup multiplication falls 99.83% over an
  active 20-second session.
- Warmed combined visual workload: 80.55% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 404.7 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 44 — cached analyzer grid geometry

Collected from WaveCandy's spectrum/meter grid and resize-acknowledgement path, exact active-session
temporary and invariant-operation counts, three checksum-equivalent 200,000-frame workloads,
generated production closures, focused Sound Designer tests, the full suite, and isolated
audio/visual gates.

| Metric | Batch 43 | Batch 44 | Change |
|---|---:|---:|---:|
| Explicit static-grid frame temporaries over 20 s | 3,600 | 0 | removed |
| Static grid logarithms over 20 s | 3,600 | 4 | -99.89% |
| Static grid normalizations over 20 s | 4,800 | 8 | -99.83% |
| Isolated grid/setup CPU, 200k frames | 208.63 ms | 48.32 ms | -76.84% |
| Deferred WaveCandy JS raw / gzip | 9.65 / 3.66 KiB | 9.98 / 3.76 KiB | +0.33 / +0.10 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.86 KiB | unchanged |
| Fully activated Home visual JS gzip | 78.30 KiB | 78.40 KiB | +0.10 KiB |
| Production deployment bytes | 1,483.06 KiB | 1,483.38 KiB | +0.32 KiB |
| Automated production budgets | 84 | 85 | +1 guardrail |

Implemented boundaries and controls:

- Hoisted the spectrum's three logarithmic x ratios, three fixed dB y ratios, and the meter's five
  fixed tick ratios/labels to module initialization. The active draw path now performs only canvas-
  size multiplication for those invariant guides.
- Moved the spectrum trace helper to module scope instead of constructing a closure in every frame.
  Raw, filled, and stroked traces retain the same point order and coordinate arithmetic.
- Replaced the frame-local tick array literals plus `Object.values(...).forEach(...)` resize
  acknowledgement with indexed constant loops and five direct controller calls. This removes one
  closure, one callback, four arrays, and their iterators from each active analyzer frame.
- Added checksum equivalence to the legacy-vs-cached workload, exact temporary/log/normalization
  reporting, and a production guard requiring module-scoped grid geometry and direct resize
  acknowledgement.

### Batch 44 verification gates

- Full suite: 56 files, 515/515 tests pass, including 20/20 focused Sound Designer cases and all
  numerical, radar, Song Study, canvas, and audio cases.
- Production delivery/static/dependency/route guardrails: 85/85 pass; WaveCandy reports zero
  explicit static-grid temporaries in steady-state frames.
- Three corrected 200,000-frame profiles measured 74.55–76.84% lower CPU time; the final pass is
  208.63 ms to 48.32 ms, a 76.84% reduction. Static logarithms and normalizations fall 99.89% and
  99.83%, respectively, over a 20-second active session.
- Warmed combined visual workload: 80.15% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.5 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 45 — reusable radar frame containers

Collected from the playing BirdsEye radar draw path, exact 20-second transient-container counts,
three checksum-equivalent 500,000-range workloads, generated production closures, focused radar
and Song Study tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 44 | Batch 45 | Change |
|---|---:|---:|---:|
| Explicit radar frame containers over 20 s playing | 4,000 | 0 | removed |
| Radar frame containers per playing frame | 8 | 0 | removed |
| BirdsEyeRadar JS raw / gzip | 6.93 / 3.05 KiB | 6.30 / 2.87 KiB | -0.63 / -0.18 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.87 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 78.40 KiB | 78.41 KiB | +0.01 KiB |
| Production deployment bytes | 1,483.38 KiB | 1,482.77 KiB | -0.61 KiB |
| Automated production budgets | 85 | 86 | +1 guardrail |

Implemented boundaries and controls:

- Converted the radar gradient, backdrop, grid, particle, note, and visible-range calls from
  frame-local argument objects to positional internal APIs. The production guard now rejects any
  reintroduction of the eight explicit playing-frame containers.
- Added an optional reusable result object to the shared visible-note binary search and retained
  stable result storage in both BirdsEyeRadar and MidiBirdsEyeView. Empty and populated ranges
  mutate the same object, including window bounds.
- Reused one active-label-position array per radar instance and reset its logical length per frame
  instead of allocating a replacement array.
- Updated gradient and range unit tests for the positional/reusable contracts. The isolated range
  workload includes a checksum equivalence assertion so allocation-policy changes cannot alter
  the visible note window silently.

### Batch 45 verification gates

- Full suite: 56 files, 515/515 tests pass, including focused radar, MidiBirdsEyeView, Song Study,
  gradient-cache, and range-identity cases.
- Production delivery/static/dependency/route guardrails: 86/86 pass; the radar reports zero
  explicit steady-state frame containers and requires reusable frame storage.
- Three 500,000-range profiles ranged from 6.77% slower to 2.82% faster. This is CPU-neutral at
  this scale, so no range-compute speedup is claimed; the measured benefit is removal of 4,000
  explicit containers per 20-second playing session and a 0.18 KiB gzip radar-chunk reduction.
- Warmed combined visual workload: 80.36% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -3 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.2 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 46 — batched loudness-meter grid path

Collected from WaveCandy's five-guide loudness meter, exact active-session Canvas 2D boundary-call
counts, three geometry/checksum-equivalent 200,000-frame dispatcher workloads, generated
production closures, focused paint-order tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 45 | Batch 46 | Change |
|---|---:|---:|---:|
| Meter grid `beginPath` calls over 20 s active | 3,000 | 600 | -80.00% |
| Meter grid `stroke` calls over 20 s active | 3,000 | 600 | -80.00% |
| Combined native path-boundary calls over 20 s | 6,000 | 1,200 | -80.00% |
| Isolated meter-grid dispatcher CPU, 200k frames | 5.48 ms | 4.75 ms | -13.37% |
| Deferred WaveCandy JS raw / gzip | 9.98 / 3.77 KiB | 10.25 / 3.84 KiB | +0.27 / +0.07 KiB |
| Initial Home JS gzip | 67.87 KiB | 67.85 KiB | -0.02 KiB |
| Fully activated Home visual JS gzip | 78.41 KiB | 78.47 KiB | +0.06 KiB |
| Production deployment bytes | 1,482.77 KiB | 1,483.03 KiB | +0.26 KiB |
| Automated production budgets | 86 | 87 | +1 guardrail |

Implemented boundaries and controls:

- Replaced five identical `beginPath`/`stroke` pairs in every loudness-meter frame with one shared
  guide path. Guide geometry, style, and the existing guides-before-labels paint order are retained.
- Unrolled the fixed five-guide coordinates after the first batched version exposed a second-loop
  penalty in the isolated JavaScript dispatcher. The corrected path removes native calls without
  adding iteration overhead.
- Added a focused mock-canvas test that verifies one begin/stroke pair, all five exact line
  coordinates, all five label coordinates, and stroke-before-label ordering.
- Added exact active-session command counts, a geometry-checksummed legacy-vs-batched workload,
  and a production guard requiring one begin/stroke pair with five guides and labels.

### Batch 46 verification gates

- Full suite: 57 files, 516/516 tests pass, including the new meter-grid geometry/paint-order case
  and all existing Sound Designer, radar, Song Study, canvas, numerical, and audio cases.
- Production delivery/static/dependency/route guardrails: 87/87 pass; WaveCandy reports one meter-
  grid `beginPath` and one `stroke` per active frame.
- Three corrected 200,000-frame profiles measured 8.96–14.30% lower dispatcher CPU; the final pass
  is 5.48 ms to 4.75 ms, a 13.37% reduction. Canvas path-boundary calls fall exactly 80% over a
  20-second active session.
- Warmed combined visual workload: 80.29% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 399.5 us per 128-frame block with 6.7x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 47 — allocation-free radar label collision scan

Collected from the active-note label-placement path, exact standard-session callback counts, four
decision-equivalent one-million-check workloads, generated production closures, focused radar and
Song Study tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 46 | Batch 47 | Change |
|---|---:|---:|---:|
| Label-collision callback allocations over 20 s | 12,480 | 0 | removed |
| Isolated label-collision CPU, 1M checks | 3.70 ms | 2.77 ms | -25.01% |
| BirdsEyeRadar JS raw / gzip | 6.30 / 2.87 KiB | 6.36 / 2.89 KiB | +0.06 / +0.02 KiB |
| Initial Home JS gzip | 67.85 KiB | 67.86 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 78.47 KiB | 78.48 KiB | +0.01 KiB |
| Production deployment bytes | 1,483.03 KiB | 1,483.08 KiB | +0.05 KiB |
| Automated production budgets | 87 | 88 | +1 guardrail |

Implemented boundaries and controls:

- Replaced `activeLabelPositions.every(...)` in the per-active-note radar path with an indexed,
  allocation-free early-exit scan over the existing reusable positions array. The strict 28-pixel
  placement boundary and insertion order are unchanged.
- Rejected an initial extracted-helper version after profiling showed its function boundary made
  the micro-workload 88–99% slower despite removing the callback. The retained version inlines the
  scan in the render loop and improves both allocation and CPU metrics.
- Added a one-million-check legacy-vs-indexed workload with an exact accepted-placement checksum,
  plus a production guard that rejects callback-based collision scans.

### Batch 47 verification gates

- Full suite: 57 files, 516/516 tests pass, including focused radar, MidiBirdsEyeView, Song Study,
  range, gradient, Sound Designer, canvas, numerical, and audio cases.
- Production delivery/static/dependency/route guardrails: 88/88 pass; the radar reports zero label-
  collision callback allocations per active-note check.
- Four corrected one-million-check profiles measured 21.24–25.01% lower CPU; the final pass is
  3.70 ms to 2.77 ms, a 25.01% reduction, while placement-decision checksums remain identical.
- Warmed combined visual workload: 80.34% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -18 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 48 — reusable WebGL scene diagnostics state

Collected from the active WebGL scene loop, exact standard-session diagnostics-object counts, four
checksum-equivalent two-million-update workloads, generated production closures, focused scene
and application tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 47 | Batch 48 | Change |
|---|---:|---:|---:|
| Scene diagnostics objects over 20 s active | 600 | 1 | -99.83% |
| Scene diagnostics objects per steady-state frame | 1 | 0 | removed |
| Isolated diagnostics update CPU, 2M frames | 11.32 ms | 2.32 ms | -79.46% |
| Deferred Scene JS raw / gzip | 10.63 / 4.78 KiB | 10.67 / 4.81 KiB | +0.04 / +0.03 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.87 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 78.48 KiB | 78.51 KiB | +0.03 KiB |
| Production deployment bytes | 1,483.08 KiB | 1,483.13 KiB | +0.05 KiB |
| Automated production budgets | 88 | 89 | +1 guardrail |

Implemented boundaries and controls:

- Replaced the per-frame `window.__sceneDebug = { ... }` object with one effect-scoped diagnostics
  object assigned once and mutated after every vortex step. The public `vortexCount`, `pulse`, and
  `level` fields retain the same values and remain available through the same global reference.
- Added a two-million-frame escaping-object workload that compares replacement and mutation paths
  with an exact cumulative-state checksum.
- Added a production guard requiring stable diagnostics identity and zero steady-state object
  allocations.
- Avoided a UI-census parser ambiguity around JavaScript `.pulse` property access; the public field
  remains unchanged and the verified UI-tell count remains 22 rather than recording a false CSS-
  animation regression.

### Batch 48 verification gates

- Full suite: 57 files, 516/516 tests pass, including focused application/scene physics cases and
  all Sound Designer, radar, Song Study, canvas, numerical, and audio cases.
- Production delivery/static/dependency/route guardrails: 89/89 pass; Scene reports zero diagnostics-
  object allocations per steady-state frame.
- Four two-million-update profiles measured 78.50–79.79% lower CPU; the final pass is 11.32 ms to
  2.32 ms, a 79.46% reduction, while cumulative-state checksums remain identical.
- Warmed combined visual workload: 80.32% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.2 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged after removing the JavaScript-property false positive.
- `git diff --check`: pass.

## Optimization batch 49 — hoisted analyzer trace scales

Collected from WaveCandy's oscilloscope and three spectrum path traversals, exact division upper
bounds, four coordinate/checksum-verified 20,000-frame workloads, generated production closures,
focused Sound Designer tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 48 | Batch 49 | Change |
|---|---:|---:|---:|
| Trace divisions over 20 s active, upper bound | 787,200 | 2,400 | -99.70% |
| Point-loop divisions per frame, upper bound | 1,312 | 0 | removed |
| Isolated trace-coordinate CPU, 20k frames | 15.03 ms | 14.18 ms | -5.64% |
| Maximum coordinate delta | — | 1.14e-13 px | below 1e-9 px gate |
| Deferred WaveCandy JS raw / gzip | 10.25 / 3.85 KiB | 10.27 / 3.86 KiB | +0.02 / +0.01 KiB |
| Initial Home JS gzip | 67.87 KiB | 67.85 KiB | -0.02 KiB |
| Fully activated Home visual JS gzip | 78.51 KiB | 78.51 KiB | unchanged |
| Production deployment bytes | 1,483.13 KiB | 1,483.15 KiB | +0.02 KiB |
| Automated production budgets | 89 | 90 | +1 guardrail |

Implemented boundaries and controls:

- Hoisted `width / (pointCount - 1)` out of the oscilloscope and spectrum point loops. Each trace
  now computes one scale and uses multiplication for every point instead of dividing every point.
- Preserved empty/single-point safety with a zero scale when the span is not greater than one.
- Added varying-width/varying-span legacy-vs-scaled workloads, a cumulative coordinate checksum,
  an explicit maximum-coordinate-delta scan, exact division upper bounds, and a production guard
  that rejects division inside either trace loop.

### Batch 49 verification gates

- Full suite: 57 files, 516/516 tests pass, including focused Sound Designer/WaveCandy cases and
  all radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 90/90 pass; WaveCandy reports zero point-
  loop trace divisions and four trace-scale divisions per active frame.
- Four 20,000-frame profiles measured 1.19–6.11% lower CPU; the final pass is 15.03 ms to 14.18 ms,
  a 5.64% reduction. Maximum coordinate drift is 1.14e-13 pixels and the cumulative checksum delta
  is zero at the reported precision.
- Warmed combined visual workload: 80.28% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 410.3 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 50 — resolution-aware oscilloscope trace

Collected from WaveCandy's 1,024-sample oscilloscope at its 330px desktop tile width, exact point-
submission counts, four 20,000-frame workloads, smooth multi-harmonic reconstruction error,
generated production closures, focused policy/Sound Designer tests, the full suite, and isolated
audio/visual gates.

| Metric | Batch 49 | Batch 50 | Change |
|---|---:|---:|---:|
| Scope points per 330px frame | 1,024 | 513 | -49.90% |
| Scope points over 20 s active | 614,400 | 307,800 | -49.90% |
| Isolated scope traversal CPU, 20k frames | 12.50 ms | 6.62 ms | -47.00% |
| Multi-harmonic reconstruction relative RMSE | — | 0.289% | below 1% gate |
| Audio-analysis policy JS raw / gzip | 0.05 / 0.07 KiB | 0.18 / 0.15 KiB | +0.13 / +0.08 KiB |
| Deferred WaveCandy JS raw / gzip | 10.27 / 3.86 KiB | 10.33 / 3.89 KiB | +0.06 / +0.03 KiB |
| Initial Home JS gzip | 67.85 KiB | 67.86 KiB | +0.01 KiB |
| Fully activated Home visual JS gzip | 78.51 KiB | 78.63 KiB | +0.12 KiB |
| Production deployment bytes | 1,483.15 KiB | 1,483.33 KiB | +0.18 KiB |
| Automated production budgets | 90 | 91 | +1 guardrail |

Implemented boundaries and controls:

- Added a resolution-aware scope policy capped at two submitted samples per CSS pixel. A 1,024-
  sample trace at the 330px desktop tile selects stride two; wider canvases retain stride one and
  narrower canvases increase the stride only as required by their display resolution.
- Explicitly submits the final analyser sample when the stride does not land on the endpoint, so
  the trace still reaches the right canvas edge and preserves the captured window boundary.
- Added policy tests for full-resolution, desktop, narrow, and degenerate widths; a deterministic
  reconstruction-error gate; exact point/session counts; repeated traversal timing; and a
  production guard requiring the density cap and endpoint branch.
- Profiled and fully rejected a preceding reciprocal dB-normalization experiment because V8
  already optimized the constant divisor and repeated timings ranged from +0.40% to -16.58%.
  None of that non-beneficial experiment is present in this checkpoint.

### Batch 50 verification gates

- Full suite: 57 files, 517/517 tests pass, including four analyzer-policy cases and all Sound
  Designer, radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 91/91 pass; WaveCandy reports a two-point-
  per-CSS-pixel scope ceiling and endpoint-preserving resolution-aware traversal.
- Four 20,000-frame profiles measured 45.34–47.48% lower scope-loop CPU; the final pass is 12.50 ms
  to 6.62 ms, a 47.00% reduction. The 330px path removes 306,600 point submissions per 20 seconds,
  while multi-harmonic reconstruction error is 0.289% RMS.
- Warmed combined visual workload: 80.36% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.4 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 51 — resolution-aware goniometer trace

Collected from WaveCandy's 512-pair stereo phase display at its representative 230x150px desktop
tile, exact Canvas point-submission and meter-evaluation counts, three independently compiled
15-sample median workloads, stereo mid/side reconstruction error, generated production closures,
focused policy tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 50 | Batch 51 | Change |
|---|---:|---:|---:|
| Goniometer points per 230x150px frame | 512 | 257 | -49.80% |
| Goniometer points over 20 s active | 307,200 | 154,200 | -49.80% |
| Stereo meter evaluations per frame | 512 | 512 | unchanged |
| Isolated goniometer arithmetic CPU, 4k frames | 2.00–2.03 ms | 1.92–1.97 ms | -1.40% to -5.12% |
| Mid/side reconstruction relative RMSE | — | 0.0213% | below 1% gate |
| Audio-analysis policy JS raw / gzip | 0.18 / 0.15 KiB | 0.31 / 0.17 KiB | +0.13 / +0.02 KiB |
| Deferred WaveCandy JS raw / gzip | 10.33 / 3.89 KiB | 10.25 / 3.89 KiB | -0.08 / unchanged |
| Initial Home JS gzip | 67.86 KiB | 67.86 KiB | unchanged |
| Fully activated Home visual JS gzip | 78.63 KiB | 78.74 KiB | +0.11 KiB |
| Production deployment bytes | 1,483.33 KiB | 1,483.62 KiB | +0.29 KiB |
| Automated production budgets | 91 | 92 | +1 guardrail |

Implemented boundaries and controls:

- Added a resolution-aware goniometer policy capped at two submitted points per largest CSS-axis
  pixel. The 512 evaluated stereo pairs at 230x150px select trace stride two; larger displays retain
  full resolution and smaller tiles increase the stride only when their display resolution requires
  it.
- Kept the loudness mean-square and peak accumulation in the complete 512-pair traversal. Only
  mid/side coordinate transforms and Canvas path submissions are thinned, so meter behavior and
  audio-analysis cadence are unchanged.
- Explicitly submits the final evaluated stereo pair when the stride does not land on it, preserving
  the captured phase-curve endpoint. Replaced a per-pair modulo test with a monotonic next-draw
  cursor after profiling the arithmetic-only path.
- Added full-resolution, desktop, narrow, and degenerate policy cases; exact point/session counts;
  a stereo reconstruction-error gate; three median timing profiles; and a production guard that
  requires both bounded path construction and full meter-statistics traversal.
- Discarded timing results from a deliberately concurrent release-gate run and reran publishable
  performance measurements serially, preventing machine contention from being recorded as product
  behavior.

### Batch 51 verification gates

- Full suite: 57 files, 518/518 tests pass, including five analyzer-policy cases and all Sound
  Designer, radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 92/92 pass; WaveCandy reports 257 phase-
  trace points and 512 meter evaluations per representative desktop frame.
- Three independently warmed 15-sample medians measured 1.40–5.12% lower arithmetic-loop CPU. The
  primary render win is exact: 153,000 fewer native Canvas point submissions per 20 seconds, while
  mid/side reconstruction error is 0.0213% RMS and the final evaluated point is preserved.
- Warmed combined visual workload: 80.12–80.32% lower normalized median CPU than the legacy
  reference, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene
  frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -43 KB over 4,000 blocks.
- Isolated DSP benchmark: 403.4 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 52 — batched and lazily initialized radar particles

Collected from the 32-particle bird's-eye MIDI radar at its 25Hz playing cadence, exact Canvas
command counts over 20 seconds, a deterministic 12-bucket occupancy model, exhaustive alpha error
across all 121 prior palette levels, React render/rerender initialization evidence, generated
production closures, focused radar tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 51 | Batch 52 | Change |
|---|---:|---:|---:|
| Particle path-boundary calls over 20 s | 32,000 | 12,000 | -62.50% |
| Total particle Canvas path commands over 20 s | 48,000 | 44,000 | -8.33% |
| Redundant radar initialization allocations per React render | 35 | 0 | removed |
| Redundant allocations over 500-render model | 17,500 | 0 | removed |
| Particle geometry delta | — | 0 | exact |
| Maximum particle-alpha error | — | 0.005 | below 0.006 gate |
| Particle-alpha relative RMSE | — | 3.783% | bounded low-opacity palette |
| Deferred BirdsEyeRadar JS raw / gzip | 6.36 / 2.89 KiB | 6.85 / 3.09 KiB | +0.49 / +0.20 KiB |
| Initial Home JS gzip | 67.86 KiB | 67.86 KiB | unchanged |
| Fully activated Home visual JS gzip | 78.74 KiB | 78.75 KiB | +0.01 KiB |
| Production deployment bytes | 1,483.62 KiB | 1,484.27 KiB | +0.65 KiB |
| Automated production budgets | 92 | 94 | +2 guardrails |

Implemented boundaries and controls:

- Quantized only the ambient particles' 0.015–0.135 alpha range into 12 prebuilt colors. Particle
  positions, radii, motion, count, and draw cadence remain unchanged; exhaustive palette analysis
  bounds maximum absolute alpha error at 0.005.
- Replaced 32 individual begin/fill path pairs with one path per occupied alpha bucket. Every circle
  receives an explicit `moveTo` before its arc, preventing Canvas from connecting adjacent circles;
  reusable Float64 geometry buffers retain the original double-precision coordinates.
- Converted particle creation, bucket buffers, note-ID cache, and the initial props ref to genuine
  lazy ref initialization. React previously evaluated 32 particle objects plus three container/cache
  initializers on every render even though `useRef` discarded every result after the first mount.
- Added endpoint/bucket/clamping cases, exhaustive alpha-quality and occupied-bucket workloads, exact
  native-command/allocation counts, a render/rerender test proving random particle construction occurs
  once, and production guards for both batched paths and lazy state initialization.

### Batch 52 verification gates

- Full suite: 58 files, 520/520 tests pass, including the new radar render/rerender case, three
  particle-palette cases, and all Sound Designer, Song Study, canvas, numerical, scene, and audio
  cases.
- Production delivery/static/dependency/route guardrails: 94/94 pass; the radar reports at most 24
  particle path-boundary calls and 88 total path commands per playing frame, with zero redundant
  initialization allocations per React render.
- The deterministic 500-frame occupancy model removes exactly 20,000 begin/fill boundary calls and
  4,000 total Canvas path commands. All particle geometry remains exact; maximum alpha error is
  0.005 and relative RMS alpha error is 3.783% within the deliberately low-opacity effect.
- Warmed combined visual workload: 80.27% lower normalized median CPU than the legacy reference,
  with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer scene frames and
  scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 402.6 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 53 — site-wide lazy mutable hook initialization

Collected from a production-source census across every route, the hot Home/playback/keyboard render
chain, direct saved-session restoration workloads, three independently launched 20,000-iteration
profiles, React render/rerender evidence, generated production closures, focused App/playback/
keyboard/control tests, the full suite, and isolated audio/visual gates.

| Metric | Batch 52 | Batch 53 | Change |
|---|---:|---:|---:|
| Production eager mutable hook initializers | 31 | 0 | removed |
| Discarded containers per hot playback render | 14 | 0 | removed |
| Discarded containers over 500-render model | 7,000 | 0 | removed |
| Session storage reads / JSON parses over 500 renders | 500 / 500 | 1 / 1 | -99.80% each |
| Session restoration model CPU, 20k renders | 69.41–70.51 ms | 0.09–0.10 ms | -99.86% to -99.87% |
| Restored-session checksum delta | — | 0 | exact |
| Initial Home JS gzip | 67.86 KiB | 67.94 KiB | +0.08 KiB |
| Fully activated Home visual JS gzip | 78.75 KiB | 78.86 KiB | +0.11 KiB |
| Sound Designer route JS gzip | 63.41 KiB | 63.45 KiB | +0.04 KiB |
| Production deployment bytes | 1,484.27 KiB | 1,484.99 KiB | +0.72 KiB |
| Automated production budgets | 94 | 96 | +2 guardrails |

Implemented boundaries and controls:

- Replaced `useRef(loadAppSession())` with React's lazy `useState(loadAppSession)` initializer.
  App renders no longer reread local storage, parse JSON, sanitize parameters, or rebuild restored
  state; the initializer still runs once for every genuine App mount.
- Converted all eager Map, Set, array, object, typed-buffer, and Verlet-chain hook initializers to
  lazy first-render initialization. The audit covers Home, MIDI playback, hardware MIDI, keyboard
  input/feedback/playback, WaveCandy, legacy MIDI view, macro dials, control-kit widgets, Voice Loop,
  Study Songs, and Control Kit.
- Converted mutable `useState` literals to lazy initializer functions on secondary routes, including
  Voice Loop form/control/status state, Control Kit's fader trio, Study Songs jobs, and playback's
  active-note Set.
- Added an App interaction test proving local storage is read once across state-driven rerenders; a
  direct real-`loadAppSession` benchmark with checksum equivalence; exact per-render/session allocation
  counts; and a production-wide guard that rejects eager mutable `useRef` or `useState` initializers.

### Batch 53 verification gates

- Full suite: 58 files, 521/521 tests pass, including the new one-read App session case and all
  Sound Designer, playback, hardware MIDI, keyboard, control-kit, radar, Song Study, canvas,
  numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 96/96 pass; production source reports zero
  eager mutable hook initializers, zero redundant hot-playback containers per render, and zero saved-
  session reads per rerender.
- Three 20,000-render profiles measured 99.86–99.87% lower session-access CPU: 69.41–70.51 ms falls
  to 0.09–0.10 ms. The 500-render playback model removes 7,000 container allocations plus 499 storage
  reads and 499 JSON parses, with an identical restored-session checksum.
- Warmed combined visual workload: 80.24% lower normalized median CPU than the legacy reference on
  the final independent pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and
  50% fewer scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 405.7 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 54 — allocation-free whole-score MIDI scheduler startup

Collected from the normalized MIDI scheduling path used by play, resume, seek, and live tempo
changes; a 10,000-note score at a 5,000-second timeline offset; three independently launched
200-operation profiles; exact relevant-note checksums; a pre-offset sustaining-note regression case;
generated production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 53 | Batch 54 | Change |
|---|---:|---:|---:|
| Wrapper objects per 10k-note schedule | 10,000 | 0 | removed |
| Whole-score queue arrays per schedule | 2 | 0 | removed |
| Total setup allocations per schedule | 10,002 | 0 | removed |
| Scheduler setup CPU, 200 x 10k-note operations | 16.24–16.60 ms | 5.35–5.48 ms | -66.88% to -67.79% |
| Relevant-note checksum delta | — | 0 | exact |
| Initial Home JS gzip | 67.94 KiB | 67.90 KiB | -0.04 KiB |
| Fully activated Home visual JS gzip | 78.86 KiB | 78.83 KiB | -0.03 KiB |
| Song Study route JS gzip | 65.70 KiB | 65.67 KiB | -0.03 KiB |
| Production deployment bytes | 1,484.99 KiB | 1,484.94 KiB | -0.05 KiB |
| Automated production budgets | 96 | 97 | +1 guardrail |

Implemented boundaries and controls:

- Removed the scheduler's `notes.map(...).filter(...)` startup queue, which created one `{ note,
  index }` wrapper per normalized note plus map and filter result arrays on every scheduling action.
- The rolling scheduler now advances an integer directly over the existing time-sorted normalized
  note array. It skips definitely ended leading notes, retains each original normalized index for
  stable voice IDs, and performs the existing remaining-duration check as notes enter the lookahead
  window.
- Preserved the subtle seek/resume case where a note starts before the requested offset but remains
  sounding afterward. A focused test starts at five seconds, schedules the sustaining earlier note,
  skips an already-ended note, and later schedules the next future note.
- Added an allocation-equivalent legacy-vs-indexed workload over 5,002 relevant notes, exact
  checksum/count gates, explicit wrapper/array allocation counts, and a production guard that rejects
  whole-score map/filter queues in the scheduler.

### Batch 54 verification gates

- Full suite: 58 files, 522/522 tests pass, including 18 MIDI playback cases and all Sound Designer,
  hardware MIDI, keyboard, control-kit, radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 97/97 pass; the 10,000-note scheduler
  reports zero wrapper objects and zero queue arrays per play/resume/seek/tempo operation.
- Three 200-operation profiles measured 66.88–67.79% lower setup CPU: 16.24–16.60 ms falls to
  5.35–5.48 ms. Every run removes 10,002 allocations per operation, preserves 5,002 relevant notes,
  and produces an identical index checksum.
- Warmed combined visual workload: 80.24% lower normalized median CPU than the legacy reference on
  the final stable pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50%
  fewer scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 411.4 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 55 — one-pass MIDI normalization with sorted-input fast path

Collected from the production note normalizer used before every MIDI play; a 10,000-note ordered
score containing 73 deliberately invalid durations; four independently launched 50-import profiles;
exact normalized-note checksums; sorted and unsorted input tests; generated production closures; the
full suite; and isolated audio/visual gates.

| Metric | Batch 54 | Batch 55 | Change |
|---|---:|---:|---:|
| Arrays per MIDI normalization | 2 | 1 | -50.00% |
| Map/filter callbacks per 10k-note import | 20,000 | 0 | removed |
| Sort calls for already sorted parser output | 1 | 0 | removed |
| Normalization CPU, 50 x 10k-note imports | 26.51–27.24 ms | 20.58–21.50 ms | -20.74% to -23.63% |
| Normalized-note checksum delta | — | 0 | exact |
| Initial Home JS gzip | 67.90 KiB | 67.94 KiB | +0.04 KiB |
| Fully activated Home visual JS gzip | 78.83 KiB | 78.86 KiB | +0.03 KiB |
| Song Study route JS gzip | 65.67 KiB | 65.70 KiB | +0.03 KiB |
| Production deployment bytes | 1,484.94 KiB | 1,485.04 KiB | +0.10 KiB |
| Automated production budgets | 97 | 98 | +1 guardrail |

Implemented boundaries and controls:

- Replaced the normalization pipeline's map/filter callback chain with one indexed loop and one
  output array. Valid notes are normalized and appended directly; invalid pitch/time/duration entries
  are skipped without null placeholders or a second array.
- Tracks normalized time order during the same traversal. Standard parser output is already sorted,
  so it now bypasses sorting entirely; genuinely unsorted external input still receives the original
  ascending-time sort before scheduling.
- Preserved caller isolation by continuing to create normalized note objects rather than mutating the
  imported score. Pitch rounding/range checks, time and duration clamping, velocity normalization,
  and instrument string cleanup remain equivalent.
- Extracted the production normalizer into a focused utility exercised directly by the performance
  workload. Added three unit cases for sorted normalization, unsorted ordering, and invalid-note
  removal, retained the end-to-end playback ordering case, and added a production guard rejecting
  map/filter intermediates or unconditional sorting.

### Batch 55 verification gates

- Full suite: 59 files, 526/526 tests pass, including three focused normalizer cases, 19 playback
  cases, and all Sound Designer, hardware MIDI, keyboard, control-kit, radar, Song Study, canvas,
  numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 98/98 pass; normalized imports report one
  output array and zero sort calls for already ordered input.
- Four 50-import profiles measured 20.74–23.63% lower CPU: 26.51–27.24 ms falls to 20.58–21.50 ms.
  Each 10,000-note import removes 20,000 callback invocations and one array, produces 9,927 normalized
  notes, and retains an identical cumulative checksum.
- Warmed combined visual workload: 80.20% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 434.3 us per 128-frame block with 6.1x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 56 — revision-aware pipeline polling identities

Collected from all three pipeline polling routes, the backend's authoritative `id`/`updated_at`
revision contract, a 100-job completed library, a ten-minute 300-poll session model, four independently
launched 2,000-poll profiles, derived-study checksums, unversioned/reordered response tests, generated
production closures, the full suite, and isolated audio/visual gates.

| Metric | Batch 55 | Batch 56 | Change |
|---|---:|---:|---:|
| Unchanged React commits per 10-minute polling route session | 300 | 0 | removed |
| Derived job evaluations per unchanged session | 30,000 | 0 | removed |
| Unchanged 100-job poll CPU, 2,000 responses | 9.55–10.01 ms | 4.12–4.34 ms | -56.30% to -57.20% |
| Derived-study checksum delta | — | 0 | exact |
| Initial Home JS gzip | 67.94 KiB | 67.92 KiB | -0.02 KiB |
| MIDI Pipeline route JS gzip | 56.87 KiB | 57.03 KiB | +0.16 KiB |
| Generated Study route JS gzip | 54.88 KiB | 55.04 KiB | +0.16 KiB |
| Study Songs route JS gzip | 54.80 KiB | 54.95 KiB | +0.15 KiB |
| Production deployment bytes | 1,485.04 KiB | 1,485.45 KiB | +0.41 KiB |
| Automated production budgets | 98 | 99 | +1 guardrail |

Implemented boundaries and controls:

- Added revision-aware job and job-list identity reuse based on the backend's `id` plus `updated_at`
  contract. Pipeline writes update `updated_at` on every state mutation, so equal revisions prove the
  response is unchanged without serializing or deeply comparing artifacts.
- Applied functional state updates in MIDI Pipeline, Generated Study, and Study Songs. Identical poll
  responses now return the current state reference, allowing React to bail out before route render,
  generated-study derivation, sorting, memo invalidation, and DOM reconciliation.
- Lists additionally require equal length, order, IDs, and revisions. Any missing revision metadata,
  changed timestamp, added/removed job, or reordered result retains the new response, so the
  optimization cannot hide updates from alternate or older APIs.
- Added three focused identity/list safety cases, an unchanged-response workload that includes
  response-object parsing/cloning on both sides, exact commit/derivation/session counts, a derived-
  study checksum, and a production guard requiring snapshot reuse on all three polling pages.

### Batch 56 verification gates

- Full suite: 60 files, 529/529 tests pass, including three pipeline identity cases, generated-study
  route cases, and all Sound Designer, MIDI playback, keyboard, control-kit, radar, Song Study,
  canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 99/99 pass; unchanged versioned pipeline
  responses report zero React commits across all three polling routes.
- Four 2,000-poll profiles measured 56.30–57.20% lower modeled route CPU: 9.55–10.01 ms falls to
  4.12–4.34 ms. A ten-minute unchanged session avoids 300 React commits and 30,000 derived job
  evaluations while retaining an identical study checksum.
- Warmed combined visual workload: 80.62% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -36 KB over 4,000 blocks.
- Isolated DSP benchmark: 415.4 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 57 — interaction-first Voice Loop score rendering

Collected from the Voice Loop route's production render lifecycle; a cold two-second idle-visit
test; first-play activation and post-play debounce tests; a 20-edit stopped-session model; generated
production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 56 | Batch 57 | Change |
|---|---:|---:|---:|
| AudioContext constructions on a cold idle visit | 1 | 0 | removed |
| Score renders on a cold idle visit | 1 | 0 | removed |
| Score renders for 20 parameter edits while stopped | 20 | 0 | removed |
| Score renders on first Play | 0 | 1 | deferred to intent |
| Duplicate render after first Play's debounce window | 1 | 0 | removed |
| Live-playing edit debounce | 260 ms | 260 ms | preserved |
| Initial Home JS gzip | 67.92 KiB | 67.93 KiB | +0.01 KiB |
| Voice Loop route JS gzip | 62.00 KiB | 62.05 KiB | +0.05 KiB |
| Production deployment bytes | 1,485.45 KiB | 1,485.52 KiB | +0.07 KiB |
| Automated production budgets | 99 | 100 | +1 guardrail |

Implemented boundaries and controls:

- Removed the route-mount render timer. Merely visiting Voice Loop now leaves `AudioContext`, the
  offline score renderer, and the rendered audio buffer uninitialized until the user presses Play.
- Parameter changes invalidate the rendered revision immediately but schedule a replacement render
  only while playback is active. Editing a stopped composition therefore remains allocation- and
  audio-work-free, while live editing retains the existing 260 ms coalescing behavior.
- Tracks render-input and completed-render revisions separately. First Play starts exactly one
  render, and the following effect pass recognizes that completed revision rather than rendering the
  same score again after the debounce interval.
- Added focused cold-mount and first-play tests plus exact production workload counters. The static
  production gate rejects reintroduction of cold score rendering or audio-context construction.

### Batch 57 verification gates

- Full suite: 61 files, 531/531 tests pass, including the two new Voice Loop lifecycle cases and all
  Sound Designer, MIDI playback, keyboard, control-kit, radar, Song Study, canvas, numerical, scene,
  and audio cases.
- Production delivery/static/dependency/route guardrails: 100/100 pass; cold Voice Loop context and
  score-render counts are both zero.
- Exact lifecycle workload removes one cold `AudioContext`, one cold score render, all 20 stopped-
  edit renders, and the former duplicate post-play render. First Play performs the one intended
  render and live edits retain the 260 ms debounce.
- Warmed combined visual workload: 80.25% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 426.2 us per 128-frame block with 6.3x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 58 — zero-commit keyboard interaction feedback

Collected from the production keyboard note and visual-feedback hooks; a 300-note interaction
session model; focused normal/profiling-mode note tests; an animation-frame hook render counter;
generated production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 57 | Batch 58 | Change |
|---|---:|---:|---:|
| Unused velocity state updates per successful note | 1 | 0 | removed |
| Velocity-only React commits per note-start frame | 1 | 0 | removed |
| Note timing samples per unprofiled successful note | 2 | 0 | removed |
| Metrics object allocations per unprofiled successful note | 1 | 0 | removed |
| Keyboard-local long-task observers per mount | 1 | 0 | removed |
| Profiling-mode note latency capture | enabled | enabled | preserved |
| Initial Home JS gzip | 67.93 KiB | 67.69 KiB | -0.24 KiB |
| Song Study route JS gzip | 65.70 KiB | 65.45 KiB | -0.25 KiB |
| Sound Designer route JS gzip | 63.46 KiB | 63.21 KiB | -0.25 KiB |
| Production deployment bytes | 1,485.52 KiB | 1,484.74 KiB | -0.78 KiB |
| Automated production budgets | 100 | 101 | +1 guardrail |

Implemented boundaries and controls:

- Removed the keyboard's unused velocity-display state, pending value, and second animation-frame
  scheduler. No live component consumed that state; the retired `KeyboardMeta` component was never
  mounted. Key activation remains a coalesced direct dataset update on the affected DOM elements.
- Removed the keyboard-local `PerformanceObserver`. The dynamically loaded central performance
  probe already owns long-task observation in development and explicit `?profile` sessions, so
  production no longer installs a duplicate observer on every playable keyboard mount.
- Gated the remaining note-latency clock samples and metrics snapshot behind the central profiler's
  active handle. Normal playback performs no timing calls or metrics-object spread; profiling mode
  retains frequency, audio-context time, and exact note latency.
- Added a hook render-count test proving that flushing visual feedback does not commit React state,
  plus a note test proving metrics stay absent normally and remain populated under the profiler.
  A production guard rejects velocity state, local observers, or always-on note timing.

### Batch 58 verification gates

- Full suite: 62 files, 533/533 tests pass, including the new zero-commit visual-feedback case,
  normal/profiling note paths, and all Sound Designer, MIDI playback, keyboard, control-kit, radar,
  Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 101/101 pass; normal notes report zero
  velocity-state updates, velocity-only commits, timing samples, metrics allocations, and local
  long-task observers.
- A modeled 300-note session removes 300 unused state updates, up to 300 velocity-only commits, 600
  timing samples, and 300 metrics snapshots. Functional note playback and coalesced key DOM feedback
  are unchanged, and the focused profiler test retains a 3 ms measured note latency exactly.
- Warmed combined visual workload: 80.93% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 430.7 us per 128-frame block with 6.2x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 59 — frame-coalesced pointer glissando

Collected from the production keyboard pointer-input hook; a 240 Hz ten-second glissando model on a
60 Hz display; latest-position, passive-listener, and release-cancellation tests; generated
production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 58 | Batch 59 | Change |
|---|---:|---:|---:|
| DOM hit tests per 240 Hz pointer frame | 4 | at most 1 | -75.00% |
| Dataset parses / note metadata objects per pointer frame | 4 | at most 1 | -75.00% |
| Pointer hot-path objects over 10 seconds | 2,400 | at most 1,200 | -50.00% |
| Pointer-move listener | non-passive | passive | scrolling contract improved |
| Pointer down / release dispatch | immediate | immediate | preserved |
| Initial Home JS gzip | 67.69 KiB | 67.81 KiB | +0.12 KiB |
| Song Study route JS gzip | 65.45 KiB | 65.58 KiB | +0.13 KiB |
| Sound Designer route JS gzip | 63.21 KiB | 63.33 KiB | +0.12 KiB |
| Production deployment bytes | 1,484.74 KiB | 1,485.22 KiB | +0.48 KiB |
| Automated production budgets | 101 | 102 | +1 guardrail |

Implemented boundaries and controls:

- Replaced synchronous work on every raw `pointermove` with one shared animation-frame flush. The
  latest coordinates and pressure are retained independently per active pointer, preserving
  multitouch while bounding processing to the display rate.
- Reuses a pointer's pending move record when multiple samples arrive before the frame. On the
  modeled 240 Hz input, four samples now produce one pending object, one DOM hit test, and at most
  one note metadata object instead of four metadata objects and four hit tests.
- Skips metadata parsing and switch dispatch when the frame's key matches the pointer's current
  note. Key press remains synchronous, and pointer up/cancel/lost-capture cancels pending work before
  stopping the current note so no stale glissando switch can fire after release.
- Marked move, up, and cancel listeners passive; the keyboard surface already declares
  `touch-action: none`, and only pointer down calls `preventDefault`. Added a deterministic four-
  sample coalescing test that verifies the latest coordinates and a release-cancellation assertion.

### Batch 59 verification gates

- Full suite: 63 files, 534/534 tests pass, including the new pointer coalescing/release case and
  all Sound Designer, MIDI playback, keyboard, control-kit, radar, Song Study, canvas, numerical,
  scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 102/102 pass; a 240 Hz input reports at
  most one pointer DOM hit test per display frame and a passive move listener.
- The ten-second interaction model reduces 2,400 DOM hit tests and note-metadata objects to at most
  600 each. The 600 pending move records yield at most 1,200 total hot-path objects, half the prior
  2,400, while preserving each pointer's latest position at every displayed frame.
- Warmed combined visual workload: 80.25% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 418.2 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- `git diff --check`: pass.

## Optimization batch 60 — zero-commit Voice Loop playhead

Collected from the production Voice Loop animation path; React Profiler commit counts; the shipped
29-event starter and 192-event display ceiling; a one-minute 25 Hz playback model; targeted DOM and
accessibility assertions; generated production closures; the full suite; and isolated audio/visual
gates.

| Metric | Batch 59 | Batch 60 | Change |
|---|---:|---:|---:|
| Page React commits per playhead tick | 1 | 0 | removed |
| Page commits per playback minute | 1,500 | 0 | removed |
| Starter event-row reconciliations per minute | 43,500 | 0 | removed |
| Maximum 192-event row reconciliations per minute | 288,000 | 0 | removed |
| Score slice arrays per playback minute | 1,500 | 0 | removed |
| Active-cell class mutations per changed tick | at most 2 | at most 2 | preserved |
| Voice Loop route JS gzip | 62.02 KiB | 62.18 KiB | +0.16 KiB |
| Production deployment bytes | 1,485.22 KiB | 1,485.57 KiB | +0.35 KiB |
| Automated production budgets | 102 | 103 | +1 guardrail |

Implemented boundaries and controls:

- Removed playhead React state from the Voice Loop page. Audio-clock sampling remains visibility-
  aware and capped at 25 Hz, but it now computes the score index in the frame callback without
  scheduling a component update.
- Tracks only the previous active index and score-grid element. A changed index removes the class
  from the previous cell and adds it to the current cell; identical-index frames return immediately.
  The rest of the composer, controls, loopbook, textarea, and score rows remain untouched.
- Direct feedback also maintains `aria-current="true"` on the active score cell. Stop, source
  restart, score replacement, effect cleanup, and unmount all clear the prior visual and accessible
  state, preventing a stale active marker.
- Added a React Profiler regression case that starts playback, advances 400 ms of clock-driven
  frames, observes the expected active cell, and proves the page commit count does not change.
  Production guards reject reintroduced playhead state or full score-row reconciliation.

### Batch 60 verification gates

- Full suite: 63 files, 535/535 tests pass, including cold/first-play Voice Loop cases, the new
  zero-commit Profiler case, and all Sound Designer, MIDI playback, keyboard, control-kit, radar,
  Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 103/103 pass; playhead ticks report zero
  React commits and zero event-row reconciliations.
- The one-minute model removes 1,500 page commits and score-slice arrays, plus 43,500 starter-row
  reconciliations or as many as 288,000 at the 192-event display ceiling. The existing maximum of
  two class mutations per changed tick is retained.
- Warmed combined visual workload: 80.32% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -19 KB over 4,000 blocks.
- Isolated DSP benchmark: 429.3 us per 128-frame block with 6.2x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: effect dependencies and cleanup are complete; state remains
  colocated to actual consumers; the targeted feedback path preserves accessible current state.
- `git diff --check`: pass.

## Optimization batch 61 — frame-coalesced continuous sliders

Collected from the shared production `ValueSlider` used by MIDI transport and sound controls; a
240 Hz ten-second drag model on a 60 Hz display; layout-read and change-callback spies; release-
flush and unmount-cleanup assertions; generated production closures; the full suite; and isolated
audio/visual gates.

| Metric | Batch 60 | Batch 61 | Change |
|---|---:|---:|---:|
| Track layout reads per 240 Hz input frame | 4 | at most 1 | -75.00% |
| Parent change callbacks per 240 Hz input frame | 4 | at most 1 | -75.00% |
| Layout reads over ten-second drag | 2,400 | at most 600 | -75.00% |
| Parent updates over ten-second drag | 2,400 | at most 600 | -75.00% |
| Pointer-down and pointer-up final value | immediate | immediate | preserved |
| Home route JS gzip | 67.84 KiB | 67.83 KiB | -0.01 KiB |
| Song Study route JS gzip | 65.60 KiB | 65.59 KiB | -0.01 KiB |
| Sound Designer route JS gzip | 63.36 KiB | 63.35 KiB | -0.01 KiB |
| Production deployment bytes | 1,485.57 KiB | 1,485.96 KiB | +0.39 KiB |
| Automated production budgets | 103 | 104 | +1 guardrail |

Implemented boundaries and controls:

- Continuous pointer moves now store only the latest horizontal coordinate and schedule one shared
  animation-frame flush. Coordinate-to-value conversion, `getBoundingClientRect`, quantization, and
  the parent callback run at most once per displayed frame instead of once per device sample.
- Pointer down still focuses, captures, and commits immediately. Pointer up/cancel synchronously
  flushes any final coordinate before releasing capture and cancels the queued frame, so the final
  value cannot lag behind the gesture.
- Keyboard nudges, wheel input, Home/End, and double-click reset retain their immediate paths. Hook
  cleanup cancels pending frame work on unmount, preventing a callback into a retired control.
- Added a deterministic four-sample drag test proving zero pre-frame layout work, one latest-value
  callback after the frame, and an immediate final-value release flush with no duplicate callback.
  Production guards reject device-rate layout reads or parent updates.

### Batch 61 verification gates

- Full suite: 63 files, 536/536 tests pass, including the expanded slider cadence/release case,
  Audio Controls and MIDI panel coverage, and all Sound Designer, MIDI playback, keyboard,
  control-kit, radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 104/104 pass; a 240 Hz drag reports at
  most one layout read and one parent update per 60 Hz display frame.
- The ten-second model removes 1,800 layout reads and 1,800 parent callbacks, reducing each from
  2,400 to at most 600 while preserving the exact latest coordinate on release.
- Warmed combined visual workload: 80.19% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 422.6 us per 128-frame block with 6.3x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: scheduled work has explicit unmount cleanup and complete callback
  dependencies; keyboard and accessibility semantics remain native and unchanged.
- `git diff --check`: pass.

## Optimization batch 62 — frame-coalesced remaining control drags

Collected from the production Sound-panel effect macro and the shared Control Kit drag hook used by
knobs, faders, and numeric fields; two 240 Hz ten-second drag models on a 60 Hz display; callback-
cadence, release-flush, and unmount-cleanup assertions; generated production closures; the full
suite; and isolated audio/visual gates.

| Metric | Batch 61 | Batch 62 | Change |
|---|---:|---:|---:|
| Effect macro parent callbacks per 240 Hz input frame | 4 | at most 1 | -75.00% |
| Control Kit parent callbacks per 240 Hz input frame | 4 | at most 1 | -75.00% |
| Combined parent callbacks over two ten-second drags | 4,800 | at most 1,200 | -75.00% |
| Control Kit drag-state commits per gesture | 2 | 2 | unchanged |
| Pointer-up final value | immediate | immediate | preserved |
| Home route JS gzip | 67.83 KiB | 67.83 KiB | unchanged |
| Control Kit route JS gzip | 53.91 KiB | 54.06 KiB | +0.15 KiB |
| Sound Designer route JS gzip | 63.35 KiB | 63.35 KiB | unchanged |
| Production deployment bytes | 1,485.96 KiB | 1,486.85 KiB | +0.89 KiB |
| Explicit animation-frame sites | 7 | 9 | +2 bounded coalescers |
| Automated production budgets | 104 | 105 | +1 guardrail |

Implemented boundaries and controls:

- The effect macro now retains only the latest vertical coordinate during a pointer burst and
  schedules one animation-frame flush. Delta calculation and the parent change callback therefore
  run at the display cadence instead of the device sampling cadence.
- The shared `useDragValue` hook applies the same policy to Control Kit knobs, faders, and numeric
  fields. The hook retains its two gesture-boundary `isDragging` commits; continuous samples do not
  add React state or create device-rate parent updates.
- Pointer release synchronously applies the latest pending coordinate before clearing each drag,
  then cancels the queued frame so it cannot duplicate the final update. Unmount cleanup cancels
  pending work in both implementations.
- Added deterministic tests proving that four same-frame samples produce one latest-value callback,
  and that a subsequent release flushes its value immediately without a trailing duplicate. The
  global animation-frame topology budget now accounts for the two intentional schedulers, while a
  feature-specific production guard requires their bounded cadence and cleanup contract.

### Batch 62 verification gates

- Full suite: 64 files, 538/538 tests pass, including new effect-macro and shared drag-hook cadence
  cases, updated knob timing coverage, and all Sound Designer, MIDI playback, keyboard, control-kit,
  radar, Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 105/105 pass; both control families report
  at most one parent update per 60 Hz display frame under a 240 Hz pointer stream.
- The two ten-second interaction models remove 3,600 parent callbacks, reducing the combined total
  from 4,800 to at most 1,200 while preserving the final pointer coordinate on release.
- Warmed combined visual workload: 80.36% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 407.4 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: animation-frame work has explicit release and unmount cleanup;
  callback dependencies are complete; native keyboard and accessible slider semantics are unchanged.
- `git diff --check`: pass.

## Optimization batch 63 — frame-coalesced Voice Loop ranges

Collected from all twelve production Voice Loop range inputs; a 240 Hz ten-second drag model on a
60 Hz display; React Profiler commit boundaries; active AudioParam and synthesis-rerender paths;
release, keyboard, blur, and unmount assertions; generated production closures; the full suite; and
isolated audio/visual gates.

| Metric | Batch 62 | Batch 63 | Change |
|---|---:|---:|---:|
| Route state updater calls per 240 Hz input frame | 4 | at most 1 | -75.00% |
| Route state object clones per 240 Hz input frame | 4 | at most 1 | -75.00% |
| State patches over ten-second drag | 2,400 | at most 600 | -75.00% |
| Active speed-drag AudioParam writes | 9,600 | at most 2,400 | -75.00% |
| Synthesis rerender debounce schedules | 2,400 | at most 600 | -75.00% |
| Pointer/key release and blur final value | immediate | immediate | preserved |
| Home route JS gzip | 67.83 KiB | 67.83 KiB | unchanged |
| Voice Loop route JS gzip | 62.18 KiB | 62.36 KiB | +0.18 KiB |
| Sound Designer route JS gzip | 63.35 KiB | 63.35 KiB | unchanged |
| Production deployment bytes | 1,486.85 KiB | 1,487.48 KiB | +0.63 KiB |
| Explicit animation-frame sites | 9 | 10 | +1 bounded coalescer |
| Automated production budgets | 105 | 106 | +1 guardrail |

Implemented boundaries and controls:

- All twelve native ranges now publish numeric state patches through one route-level animation-
  frame scheduler. Repeated samples retain only the latest value per changed field, and different
  fields changed before the same frame are merged into one form/control patch pair.
- The speed, gain, tone, and wet path therefore reaches the live audio graph no more than once per
  displayed frame. Voice synthesis inputs likewise create no more than one 260 ms rerender-debounce
  cycle per frame while retaining the existing single final render after the gesture settles.
- Pointer up/cancel, keyboard release, and blur flush the latest pending patch immediately. Unmount
  cancels the frame and clears both pending patch objects, preventing state publication after route
  teardown.
- Added a React Profiler regression case proving four raw range changes cause no pre-frame commit,
  one bounded update batch publishes the latest value, release publishes its final value without a
  trailing frame, and unmount cancels scheduled work. A production guard rejects device-rate range
  state updates or missing release/cleanup behavior.

### Batch 63 verification gates

- Full suite: 64 files, 539/539 tests pass, including the expanded Voice Loop range cadence,
  release, and teardown case and all Sound Designer, MIDI playback, keyboard, control-kit, radar,
  Song Study, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 106/106 pass; the twelve ranges report at
  most one state updater and one state-object clone per 60 Hz display frame under a 240 Hz stream.
- The ten-second interaction model removes 1,800 route state updates and object clones. During live
  speed adjustment it also removes 7,200 AudioParam writes; synthesis controls avoid 1,800 redundant
  debounce timer schedules while preserving the final deferred audio render.
- Warmed combined visual workload: 80.28% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -19 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.7 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: frame work has explicit release and unmount cleanup, dependencies are
  complete, and native range keyboard and accessible-label semantics remain intact.
- `git diff --check`: pass.

## Optimization batch 64 — isolated Control Kit primitives and static geometry

Collected from the production Control Kit route's 29 top-level primitives and seven nested knob
readouts; React memo-boundary format spies; a ten-second 60 Hz active-knob model; steady-state knob
and fader SVG geometry allocation counts; generated production closures; the full suite; and
isolated audio/visual gates.

| Metric | Batch 63 | Batch 64 | Change |
|---|---:|---:|---:|
| Primitive renders per active-knob parent update | 36 | at most 2 | -94.44% |
| Unrelated primitive renders per parent update | 34 | 0 | removed |
| Primitive renders over ten-second knob drag | 21,600 | at most 1,200 | -94.44% |
| Knob tick trig evaluations over drag | 26,400 | 0 | removed |
| Knob tick point objects over drag | 13,200 | 0 | removed |
| Knob tick React elements over drag | 6,600 | 0 | removed |
| Fader tick Set allocations over drag | 600 | 0 | removed |
| Fader tick React elements over drag | 3,000 | 0 | removed |
| Home route JS gzip | 67.83 KiB | 67.83 KiB | unchanged |
| Control Kit route JS gzip | 54.06 KiB | 54.18 KiB | +0.12 KiB |
| Sound Designer route JS gzip | 63.35 KiB | 63.35 KiB | unchanged |
| Production deployment bytes | 1,487.48 KiB | 1,487.57 KiB | +0.09 KiB |
| Automated production budgets | 106 | 107 | +1 guardrail |

Implemented boundaries and controls:

- Wrapped the five shared primitives—Knob, Fader, NumField, ToggleBtn, and SegmentSelect—in shallow
  memo boundaries. A route state change now re-enters only the control whose value or dependent
  disabled state changed; sibling primitive subtrees retain their rendered result.
- Hoisted every Control Kit format function and memoized the three fader-trio setters. Primitive
  props now remain referentially stable across unrelated page updates, allowing the memo boundaries
  to hold instead of being defeated by fresh inline callbacks.
- Precomputed both knob sizes' eleven static tick elements once at module initialization. Active
  value renders still update the arc, pointer, visible value, and ARIA value, but no longer repeat 22
  Cartesian point calculations or allocate eleven tick elements per frame.
- Memoized fader tick elements by orientation, ratios, and track length and replaced the per-render
  major-index Set. Cap, fill, visible value, and ARIA state still follow every published value while
  static track geometry remains reusable.
- Added parent-rerender regression cases for knobs and faders: unchanged scalar and function props do
  not re-run formatting, while a changed value does. A production guard requires all five memo
  boundaries, stable page callbacks, and both static-geometry caches.

### Batch 64 verification gates

- Full suite: 64 files, 541/541 tests pass, including the new knob/fader memo-boundary cases and all
  Sound Designer, Voice Loop, MIDI playback, keyboard, control-kit, radar, Song Study, canvas,
  numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 107/107 pass; active knob updates report at
  most two primitive renders, zero unrelated primitive renders, and zero steady-state static tick
  allocations for both knobs and faders.
- The ten-second model removes at least 20,400 primitive renders, 26,400 trigonometric evaluations,
  13,200 point objects, 9,600 static tick elements, and 600 Set allocations while retaining exact
  control value, interaction, visible readout, and accessibility behavior.
- Warmed combined visual workload: 80.32% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -40 KB over 4,000 blocks.
- Isolated DSP benchmark: 413.7 us per 128-frame block with 6.4x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: memoization is applied to measured expensive subtrees with stable
  props; active value and accessibility state remain explicit; hook dependencies and cleanup hold.
- `git diff --check`: pass.

## Optimization batch 65 — preview-only Song Study pointer scrubbing

Collected from the production Song Study transport and MIDI seek implementation; a 240 Hz ten-
second pointer scrub model on a 60 Hz display; engine-seek, scheduler-reset, active-voice, audio-
readiness, lookahead, note-window, release, keyboard, and unmount assertions; generated production
closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 64 | Batch 65 | Change |
|---|---:|---:|---:|
| Visual preview updates over ten-second scrub | 2,400 | at most 600 | -75.00% |
| Total route state updates over scrub | 2,400 | at most 601 | -74.96% |
| MIDI scheduler resets over pointer scrub | 2,400 | 1 | -99.96% |
| Active-voice stop passes over pointer scrub | 2,400 | 1 | -99.96% |
| Audio-readiness requests over pointer scrub | 2,400 | 1 | -99.96% |
| Lookahead reschedules over pointer scrub | 2,400 | 1 | -99.96% |
| Current-note window derivations | 2,400 | at most 601 | -74.96% |
| Keyboard and assistive-value changes | immediate | immediate | preserved |
| Initial Home JS gzip | 67.83 KiB | 67.83 KiB | unchanged |
| Song Study route JS gzip | 65.59 KiB | 65.85 KiB | +0.26 KiB |
| Control Kit route JS gzip | 54.18 KiB | 54.19 KiB | +0.01 KiB |
| Sound Designer route JS gzip | 63.35 KiB | 63.35 KiB | unchanged |
| Production deployment bytes | 1,487.57 KiB | 1,488.36 KiB | +0.79 KiB |
| Explicit animation-frame sites | 10 | 11 | +1 bounded coalescer |
| Automated production budgets | 107 | 108 | +1 guardrail |

Implemented boundaries and controls:

- Pointer scrubbing now stores only the latest transport time and publishes a visual preview at
  most once per display frame. Harmony, bass/lead, folded keyboard notes, progress text, and the
  scrubber remain responsive without touching the MIDI engine during the gesture.
- Pointer up/cancel or blur resolves the latest pending or displayed preview and performs one exact
  engine seek. That single boundary owns timeout clearing, active-voice release, progress-loop stop,
  audio-context readiness, sustaining-note recovery, lookahead rescheduling, and progress restart.
- Keyboard and assistive-technology changes do not enter pointer-preview mode and continue to seek
  immediately. Route/study changes and unmount cancel pending preview frames and clear their refs,
  preventing a stale seek or state publication after navigation.
- Added a regression case proving four raw pointer values cause zero engine seeks, one frame shows
  the latest preview, release seeks exactly once to an unflushed final value, no trailing frame seeks
  again, non-pointer changes remain immediate, and teardown cancels scheduled preview work. A
  production guard requires the same separation between preview and engine commit.

### Batch 65 verification gates

- Full suite: 64 files, 542/542 tests pass, including the new Song Study pointer-preview, exact-
  release, keyboard-immediacy, and teardown case and all Sound Designer, Voice Loop, MIDI playback,
  keyboard, control-kit, radar, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 108/108 pass; a 240 Hz pointer scrub
  reports at most one preview update per 60 Hz frame and exactly one scheduler rebuild per gesture.
- The ten-second model removes 2,399 scheduler resets, voice-stop passes, audio-readiness requests,
  and lookahead reschedules, plus at least 1,799 route updates and current-note window derivations.
- Warmed combined visual workload: 80.25% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -39 KB over 4,000 blocks.
- Isolated DSP benchmark: 407.6 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: high-frequency preview state is isolated from engine mutation;
  scheduled work has route-change/unmount cleanup; native keyboard and accessibility semantics hold.
- `git diff --check`: pass.

## Optimization batch 66 — single-source, frame-cached Song Study title fitting

Collected from the production Song Study single-line title layout effect; a ten-second 240 Hz window
resize plus 60 Hz ResizeObserver delivery model; style invalidation, layout-read, unchanged-width,
font-readiness, listener-source, frame, and unmount assertions; generated production closures; the
full suite; and isolated audio/visual gates.

| Metric | Batch 65 | Batch 66 | Change |
|---|---:|---:|---:|
| Title fit calls per 240 Hz resize display frame | 5 | at most 1 | -80.00% |
| Title fit calls over ten-second resize | 3,000 | at most 600 | -80.00% |
| Style invalidations over resize | 3,000 | at most 600 | -80.00% |
| Container/computed-style/scroll-width reads each | 3,000 | at most 600 | -80.00% |
| Unchanged-width observer fits | 600 | 0 | removed |
| Resize sources when ResizeObserver exists | 2 | 1 | duplicate removed |
| Possible post-unmount font-ready fits | 1 | 0 | removed |
| Initial synchronous fit before paint | enabled | enabled | preserved |
| Initial Home JS gzip | 67.83 KiB | 67.83 KiB | unchanged |
| Song Study route JS gzip | 65.85 KiB | 65.95 KiB | +0.10 KiB |
| Control Kit route JS gzip | 54.19 KiB | 54.18 KiB | -0.01 KiB |
| Sound Designer route JS gzip | 63.35 KiB | 63.36 KiB | +0.01 KiB |
| Production deployment bytes | 1,488.36 KiB | 1,488.59 KiB | +0.23 KiB |
| Explicit animation-frame sites | 11 | 12 | +1 bounded coalescer |
| Automated production budgets | 108 | 109 | +1 guardrail |

Implemented boundaries and controls:

- Uses ResizeObserver as the sole resize source when available; the window listener is now only a
  compatibility fallback. A normal viewport resize can no longer enter the same forced-layout path
  from both sources.
- Observer or fallback callbacks publish one pending fit through an animation frame. The fitter
  caches the last container width and returns before removing inline size or reading computed and
  scroll geometry when an observer delivery does not represent a width change.
- The first title fit remains synchronous in the layout effect to prevent visible post-paint text
  resizing. Font readiness requests one forced cached-frame fit so changed font metrics are still
  measured even when container width is unchanged.
- Cleanup marks the closure disposed, cancels its pending frame, removes only the installed fallback
  listener, and disconnects the observer. A late font-ready promise can schedule no DOM mutation.
- Added a regression case with a controlled observer proving three deliveries schedule one frame,
  no duplicate window resize listener is installed, and teardown cancels the frame and disconnects
  exactly once. A production guard pins the same cached, exclusive-source, teardown-safe structure.

### Batch 66 verification gates

- Full suite: 64 files, 543/543 tests pass, including the new Song Study title resize-source,
  coalescing, and teardown case and all Sound Designer, Voice Loop, MIDI playback, keyboard,
  control-kit, radar, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 109/109 pass; title fitting reports at most
  one layout pass per 60 Hz frame and one resize source when ResizeObserver is supported.
- The ten-second model removes at least 2,400 title fits and each corresponding style invalidation,
  container-width read, computed-style read, and scroll-width read, plus all 600 unchanged-width fits.
- Warmed combined visual workload: 80.38% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 408.2 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: synchronous layout is limited to the initial visual invariant;
  scheduled work is cached and cleanup-safe; observer and promise lifetimes cannot escape the route.
- `git diff --check`: pass.

## Optimization batch 67 — cached keyboard elements and reusable radar props

Collected from the shared 18-key desktop keyboard and MIDI radar used by Home, Sound Designer, and
Song Study; a ten-second 60 Hz parameter-update model; a one-minute 25 Hz radar progress model;
active-note membership spies; element, style, props-snapshot, and unrelated-render counts; generated
production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 66 | Batch 67 | Change |
|---|---:|---:|---:|
| Key React elements over parameter drag | 10,800 | 0 | removed |
| Active-note membership checks over parameter drag | 10,800 | 0 | removed |
| Key map callbacks over parameter drag | 10,800 | 0 | removed |
| Keyboard grid-style objects over parameter drag | 600 | 0 | removed |
| Unchanged radar renders over unrelated parent updates | 600 | 0 | removed |
| Radar props-snapshot objects per playback minute | 1,500 | 0 | removed |
| Key refresh when active notes/octave/layout changes | enabled | enabled | preserved |
| Radar refresh when visual props change | enabled | enabled | preserved |
| Initial Home JS gzip | 67.83 KiB | 67.88 KiB | +0.05 KiB |
| Song Study route JS gzip | 65.95 KiB | 65.99 KiB | +0.04 KiB |
| Control Kit route JS gzip | 54.18 KiB | 54.18 KiB | unchanged |
| Sound Designer route JS gzip | 63.36 KiB | 63.40 KiB | +0.04 KiB |
| Production deployment bytes | 1,488.59 KiB | 1,488.77 KiB | +0.18 KiB |
| Automated production budgets | 109 | 110 | +1 guardrail |

Implemented boundaries and controls:

- Memoizes white- and black-key element arrays by key metadata, active-note set, and the stable
  registration callback. Audio-parameter, waveform, WASM-readiness, and unrelated parent renders
  still synchronize their playback refs, but no longer remap visually unchanged keys.
- Memoizes the white-key grid style by visible key count and replaces the default-parameter
  `new Set()` with one module-level empty active-note set, removing another object source for callers
  that omit external activity.
- Reuses the radar's props-ref object and mutates its five slots before the canvas loop reads them.
  Progress and active-note changes therefore reach the next frame without allocating a React-render
  snapshot object.
- Adds a memo boundary around the radar. Home parameter or notice updates and Song Study state that
  leaves MIDI, progress, active notes, playback state, and render window unchanged no longer re-enter
  the radar component; genuine visual prop changes still do.
- Added a keyboard regression case that changes only the audio-parameter object and proves the
  active-note membership spy receives no new calls. A production guard pins both key caches, the
  grid cache, reusable radar props, and the radar memo boundary.

### Batch 67 verification gates

- Full suite: 65 files, 544/544 tests pass, including the new shared-keyboard render-isolation case,
  radar initialization coverage, and all Sound Designer, Voice Loop, Song Study, MIDI playback,
  control-kit, canvas, numerical, scene, and audio cases.
- Production delivery/static/dependency/route guardrails: 110/110 pass; parameter-only keyboard
  renders report zero key-element allocations, membership checks, and grid-style objects, while
  radar renders report zero props-snapshot objects and zero unchanged-parent re-entry.
- The ten-second model removes 10,800 each of key elements, membership checks, and map callbacks,
  plus 600 grid-style objects and unrelated radar renders. The playback model removes 1,500 radar
  snapshot objects per minute without altering the canvas's live prop cadence.
- Warmed combined visual workload: 80.31% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 412.5 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: memo inputs match actual visual dependencies; audio refs still update
  after committed props; radar loop state is reusable and scoped to the mounted component.
- `git diff --check`: pass.

## Optimization batch 68 — frozen hidden sidebar panel subtrees

Collected from the production Sidebar's persistent Sound and MIDI panels; a ten-second 60 Hz closed
Sound-context model; a one-minute 25 Hz closed MIDI-progress model; mocked panel render counters;
close, hidden-update, state-preservation, reopen-resynchronization, and live-open assertions;
generated production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 67 | Batch 68 | Change |
|---|---:|---:|---:|
| Closed Sound expensive component renders | 3,000 | 0 | removed |
| Expensive Sound renders per hidden context update | 5 | 0 | removed |
| Closed MIDI expensive component renders per minute | 4,500 | 0 | removed |
| Expensive MIDI renders per hidden progress update | 3 | 0 | removed |
| Cheap context-bridge renders per hidden update | 0 | 1 | intentional boundary |
| Panel remains mounted while closed | yes | yes | state preserved |
| Latest context applied on reopen | yes | yes | preserved |
| Open-panel live updates | enabled | enabled | preserved |
| Initial Home JS gzip | 67.88 KiB | 67.94 KiB | +0.06 KiB |
| Song Study route JS gzip | 65.99 KiB | 65.99 KiB | unchanged |
| Control Kit route JS gzip | 54.18 KiB | 54.18 KiB | unchanged |
| Sound Designer route JS gzip | 63.40 KiB | 63.46 KiB | +0.06 KiB |
| Production deployment bytes | 1,488.77 KiB | 1,488.98 KiB | +0.21 KiB |
| Automated production budgets | 110 | 111 | +1 guardrail |

Implemented boundaries and controls:

- Moved Sound and MIDI context consumption into minimal bridge components. The bridges still observe
  upstream context so reopening never sees stale transport or sound state, but they publish that
  context to a separate memoized panel-content boundary.
- The panel comparator accepts live value changes while open, performs the open-to-closed and closed-
  to-open synchronization renders, and treats subsequent closed-to-closed value changes as equal.
  SoundTab, AudioControls, PresetShelf, UIOverlay, MidiTab, and MidiPlayer no longer enter hidden work.
- Retains the existing `hasOpened` mount policy. Preset browse/name state, MIDI library state, and
  other local panel state survive close/reopen; this optimization does not substitute unmounting for
  render isolation.
- Added render-counter regressions for both contexts. The Sound case opens, closes, changes the full
  context while hidden, proves the subtree stays mounted without rendering, then proves one reopen
  render receives the latest value. The MIDI case proves a closed progress tick cannot re-enter its
  panel. Existing coverage retains live-open updates and unrelated-context isolation.
- Added a production guard requiring both bridges, the hidden-aware comparator, active-state wiring,
  and the persistent mount boundary.

### Batch 68 verification gates

- Full suite: 65 files, 546/546 tests pass, including twelve Sidebar cases and all Sound Designer,
  Voice Loop, Song Study, MIDI playback, keyboard, control-kit, radar, canvas, numerical, scene, and
  audio cases.
- Production delivery/static/dependency/route guardrails: 111/111 pass; hidden Sound and MIDI updates
  report zero expensive subtree renders and exactly one cheap bridge render per context publication.
- The modeled closed sessions remove 3,000 Sound subtree renders and 4,500 MIDI subtree renders while
  preserving local component state, exact reopen synchronization, and all visible-panel updates.
- Warmed combined visual workload: 80.15% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds
  pass, and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.9 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: memoization encloses measured expensive subtrees rather than context
  itself; hidden local state remains colocated and mounted; visible values resynchronize explicitly.
- `git diff --check`: pass.

## Optimization batch 69 — isolated Sound Designer base-stage renders

Collected from the Sound Designer parameter-update path; source-level render guards; a ten-second
60 Hz active-parameter model; generated production closures; the full suite; and isolated
audio/visual gates.

| Metric | Batch 68 | Batch 69 | Change |
|---|---:|---:|---:|
| Base-stage renders over a ten-second parameter drag | 600 | 0 | removed |
| Footer-navigation renders over the drag | 600 | 0 | removed |
| Folded preset-shelf renders over the drag | 600 | 0 | removed |
| Total isolated subtree component renders | 1,800 | 0 | removed |
| Waveform-option evaluations | 2,400 | 0 | removed |
| Preset prop-bundle objects | 600 | 0 | removed |
| Hidden save-only audio dependencies | 1 | 0 | removed |
| Sound Designer route JS gzip | 63.46 KiB | 63.48 KiB | +0.02 KiB |
| Initial Home JS gzip | 67.94 KiB | 67.93 KiB | -0.01 KiB |
| Production deployment bytes | 1,488.98 KiB | 1,489.01 KiB | +0.03 KiB |
| Automated production budgets | 111 | 112 | +1 guardrail |

Implemented boundaries and controls:

- Memoized the Base stage and its static footer navigation so continuous parent audio-parameter
  updates no longer rebuild waveform choices, preset navigation, or stage-navigation markup.
- Memoized PresetShelf and stabilized its Sound Designer prop bundle. Because this route deliberately
  hides preset saving, it no longer subscribes that folded shelf to `waveformType` or `audioParams`;
  SoundTab retains the complete save inputs.
- Preserved direct waveform selection and preset application through their existing stable handlers.
- Added production signals for Base-stage, folded-shelf, and prop-bundle work per audio frame, plus a
  source guard that rejects reintroduction of save-only audio dependencies into the folded shelf.

### Batch 69 verification gates

- Full suite: 65 files, 546/546 tests pass, including all twenty Sound Designer cases, four
  PresetShelf cases, twelve Sidebar cases, and all audio, keyboard, visual, MIDI, and route cases.
- Production delivery/static/dependency/route guardrails: 112/112 pass; parameter-only frames report
  zero Base-stage renders, zero folded-shelf renders, and zero Base prop-bundle allocations.
- The ten-second model removes 1,800 isolated component renders, 2,400 waveform-option evaluations,
  and 600 temporary prop objects while preserving waveform changes, preset application, and SoundTab
  saving behavior.
- Warmed combined visual workload: 79.96% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds pass,
  and saturated heap drift is -26 KB over 4,000 blocks.
- Isolated DSP benchmark: 406.9 us per 128-frame block with 6.6x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: memo boundaries receive stable props; save-only dependencies are
  removed only from a save-disabled consumer; interactive handlers and accessibility remain live.
- `git diff --check`: pass.

## Optimization batch 70 — parameter-keyed advanced Sound Designer controls

Collected from the Sound Designer Motion-stage update path; a ten-second 60 Hz active-slider model;
source-level isolation guards; generated production closures; the full suite; and isolated
audio/visual gates.

| Metric | Batch 69 | Batch 70 | Change |
|---|---:|---:|---:|
| Slider component renders over a ten-second Motion drag | 4,800 | 600 | -87.5% |
| Unrelated slider component renders | 4,200 | 0 | removed |
| Unchanged modulation-matrix renders | 600 | 0 | removed |
| Advanced footer-navigation renders | 600 | 0 | removed |
| Measured advanced child renders | 6,000 | 600 | -90.0% |
| Slider value conversions | 4,800 | 600 | -87.5% |
| Sound Designer route JS gzip | 63.48 KiB | 63.50 KiB | +0.02 KiB |
| Initial Home JS gzip | 67.93 KiB | 67.94 KiB | +0.01 KiB |
| Production deployment bytes | 1,489.01 KiB | 1,489.46 KiB | +0.45 KiB |
| Automated production budgets | 112 | 113 | +1 guardrail |

Implemented boundaries and controls:

- Added a memoized parameter-slider boundary that receives only its immutable slider descriptor,
  current scalar value, and stable parameter dispatcher. A changed Motion parameter now re-enters
  its own slider while the other seven visible slider assemblies remain untouched.
- Moved slider conversion, formatting, and callback creation inside that keyed boundary so unrelated
  parent updates do not repeat those calculations or rebuild ValueSlider descendants.
- Memoized the advanced-stage footer, whose stage and navigation props do not change during a drag.
- Added a route-aware modulation-matrix boundary. It compares the small normalized route records by
  `src`, `dst`, and `depth`, avoiding matrix reconstruction when full audio sanitization returns an
  equivalent route array with a new identity; actual route edits still render immediately.
- Added production signals and a guard for slider, matrix, and footer isolation.

### Batch 70 verification gates

- Full suite: 65 files, 546/546 tests pass, including all twenty Sound Designer cases and all
  ValueSlider, preset, keyboard, audio, visual, MIDI, and route cases.
- Production delivery/static/dependency/route guardrails: 113/113 pass; one Motion parameter frame
  reports one active slider render, zero unrelated slider renders, zero unchanged-matrix renders,
  and zero footer renders.
- The ten-second model removes 5,400 measured child renders and 4,200 redundant slider conversions,
  while preserving active-slider values, modulation-route editing, navigation, and accessibility.
- Warmed combined visual workload: 80.43% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds pass,
  and saturated heap drift is -40 KB over 4,000 blocks.
- Isolated DSP benchmark: 407.9 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: memo props are scalar or stable; the route comparator covers every
  rendered route field; live callbacks retain current stable dispatchers; control semantics are intact.
- `git diff --check`: pass.

## Optimization batch 71 — single-pass normalized audio-parameter handoff

Collected from the Home and Sound Designer parameter-publication paths; a 20,000-update isolated
normalization benchmark; a ten-second 60 Hz control model; lazy-runtime forwarding tests; generated
production closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 70 | Batch 71 | Change |
|---|---:|---:|---:|
| Sanitization passes over ten seconds | 1,200 | 600 | -50.0% |
| Duplicate runtime sanitization passes | 600 | 0 | removed |
| Ranged fields revisited by duplicate passes | 26,400 | 0 | removed |
| 20,000-update isolated workload | 198.73 ms | 143.18 ms | -27.95% |
| Parameter checksum delta | — | 0 | exact |
| Initial Home JS gzip | 67.94 KiB | 68.01 KiB | +0.07 KiB |
| Song Study route JS gzip | 65.99 KiB | 66.05 KiB | +0.06 KiB |
| Sound Designer route JS gzip | 63.50 KiB | 63.56 KiB | +0.06 KiB |
| Production deployment bytes | 1,489.46 KiB | 1,489.94 KiB | +0.48 KiB |
| Automated production budgets | 113 | 114 | +1 guardrail |

Implemented boundaries and controls:

- Added an explicit `setSanitizedGlobalParams` route through the lazy gateway and loaded runtime.
  Home and Sound Designer use it only for React state that has already passed `sanitizeAudioParams`.
- Preserved `setGlobalParams` as the defensive arbitrary-input API; it still performs a complete
  normalization before touching runtime state.
- Recorded whether the latest pending cold-runtime parameters are normalized. When the runtime loads,
  the gateway forwards them through the matching safe path rather than losing that property.
- Added gateway coverage for the cold pending handoff and subsequent warm updates, plus production
  signals requiring both UI consumers, the lazy gateway, the direct runtime path, and the defensive
  sanitizer to remain wired together.

### Batch 71 verification gates

- Full suite: 65 files, 547/547 tests pass, including the new normalized lazy-handoff case and all
  audio-runtime, Home, Sound Designer, keyboard, visual, MIDI, and route cases.
- Production delivery/static/dependency/route guardrails: 114/114 pass; normalized UI updates report
  one sanitizer pass and zero duplicate runtime passes, while arbitrary input still reports one pass.
- The release benchmark removes one complete 44-range/object/mod-route normalization per control
  frame and lowers the 20,000-update workload by 27.95% with a zero checksum delta.
- Warmed combined visual workload: 80.43% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds pass,
  and saturated heap drift is -38 KB over 4,000 blocks.
- Isolated DSP benchmark: 411.4 us per 128-frame block with 6.5x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: normalized state ownership remains at each page boundary; effects keep
  complete dependencies; the lazy gateway preserves the latest publication without eager loading.
- `git diff --check`: pass.

## Optimization batch 72 — allocation-free runtime parameter change detection

Collected from the loaded audio-runtime parameter path; a 100,000-update signature-versus-field
benchmark; a ten-second 60 Hz control model; exact route-comparison tests; generated production
closures; the full suite; and isolated audio/visual gates.

| Metric | Batch 71 | Batch 72 | Change |
|---|---:|---:|---:|
| 100,000 change detections | 264.25 ms | 73.85 ms | -72.05% |
| Detected-change count delta | — | 0 | exact |
| `Object.values` arrays over ten seconds | 600 | 0 | removed |
| Signature map-result arrays | 600 | 0 | removed |
| Joined full-parameter strings | 600 | 0 | removed |
| Serialized modulation-route strings | 600 | 0 | removed |
| Compared normalized fields | 54 | 54 | complete |
| Initial Home JS gzip | 68.01 KiB | 68.02 KiB | +0.01 KiB |
| Sound Designer route JS gzip | 63.56 KiB | 63.56 KiB | unchanged |
| Production deployment bytes | 1,489.94 KiB | 1,490.21 KiB | +0.27 KiB |
| Automated production budgets | 114 | 115 | +1 guardrail |

Implemented boundaries and controls:

- Replaced runtime construction of a full formatted parameter signature with a fixed list derived
  once from the normalized default schema and an early-exit scalar comparison.
- Compared modulation routes explicitly by length and their rendered/runtime fields (`src`, `dst`,
  and `depth`), retaining deep equality when sanitization returns an equivalent new route array.
- Retained the runtime's empty/applied sentinel. Graph creation and transport-tempo changes still
  clear it and force a complete Web Audio parameter application even when parameter fields match.
- Added exact tests for equivalent cloned routes, scalar changes, and route-depth changes, plus a
  production guard that rejects signature serialization returning to the runtime update path.

### Batch 72 verification gates

- Full suite: 65 files, 548/548 tests pass, including the new allocation-free equality case and all
  synth runtime, gateway, Home, Sound Designer, keyboard, visual, MIDI, and route cases.
- Production delivery/static/dependency/route guardrails: 115/115 pass; changed runtime updates report
  zero signature arrays, zero joined signatures, and zero serialized route strings.
- The release benchmark lowers 100,000 change detections by 72.05% with identical change counts;
  the ten-second model removes 2,400 explicit transient arrays/strings.
- Warmed combined visual workload: 80.30% lower normalized median CPU than the legacy reference on
  the release pass, with 78.18% fewer analyzer samples, 65.71% fewer resample samples, and 50% fewer
  scene frames and scene-band evaluations.
- Audio audit: 225/225 synth renders bit-exact, 7/7 FX cases pass, all audible alias thresholds pass,
  and saturated heap drift is -40 KB over 4,000 blocks.
- Isolated DSP benchmark: 426.8 us per 128-frame block with 6.2x realtime headroom.
- Production dependency audit: 0 vulnerabilities at low-or-higher severity.
- UI-tell census: 22 total, unchanged.
- React best-practices review: parameter publication remains effect-driven with complete dependencies;
  comparison state is runtime-owned and cannot trigger React work; force-reapply semantics are explicit.
- `git diff --check`: pass.
