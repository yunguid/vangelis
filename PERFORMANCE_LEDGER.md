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
