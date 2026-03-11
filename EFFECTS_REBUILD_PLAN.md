# Effects Rebuild Plan

This document is a grounded plan for rebuilding delay and reverb in Vangelis from the current implementation toward something closer to professional plugin behavior.

## Current State

The current effects live in the shared Web Audio graph:

- Delay is a stereo `DelayNode` pair with fixed ping-pong style routing, lowpass filtering, and feedback.
- Reverb is a `ConvolverNode` loaded with a generated impulse response at startup.
- The UI exposes only one `delay` control and one `reverb` control.

Relevant files:

- `sound-engine/frontend/src/utils/audioEngine/graph.js`
- `sound-engine/frontend/src/utils/audioEngine.js`
- `sound-engine/frontend/src/utils/audioParams.js`
- `sound-engine/frontend/src/components/AudioControls.jsx`

## What The Current Code Actually Does

### Delay

The `delay` slider is not just delay time. It also drives:

- left/right delay times
- feedback amount
- send level
- wet level

That means one UI control is silently moving four different internal behaviors. This is convenient for a quick prototype, but it prevents deliberate sound design and makes it hard to reason about presets.

The current implementation is also not tempo-synced, despite project docs describing it that way.

### Reverb

The `reverb` slider is also a macro. It drives:

- reverb send
- pre-delay
- wet gain

The actual reverb tail comes from one static, randomly generated impulse response. There is no independent control over:

- room/plate/hall character
- decay time / RT60
- diffusion
- damping
- early reflections
- late tail shape
- modulation
- stereo width

Because the current design uses a `ConvolverNode` with a static buffer, it is a poor fit for a reverb we want to shape interactively in real time.

## Main Limitations

### DSP limitations

- Delay has no tempo sync, note divisions, crossfeed control, ducking, modulation, drive, or independent tone shaping.
- Reverb has no algorithmic control surface. Most sonic character is baked into a single generated IR.
- Reverb IR generation is random, so behavior is not tightly authored or reproducible.
- `ConvolverNode` normalization is left at its default behavior, which makes level management less explicit.

### Product limitations

- Effects are exposed as two coarse sliders instead of actual instruments.
- There is no effect model with named modes or presets.
- Delay and reverb parameters cannot be automated or explained cleanly because most behavior is hidden inside internal heuristics.

## Recommendation: Start With Delay

Start with delay first.

Reasons:

1. Delay is the smaller, more controllable system.
2. A high-quality delay forces us to build the exact primitives reverb will need next: delay lines, interpolation, filters, modulation, smoothing, feedback topology, and effect parameter plumbing.
3. The current delay is much easier to replace incrementally without destabilizing the whole sound engine.
4. A better delay immediately improves musicality and gives us a better UI pattern for effect modules.
5. Once delay infrastructure exists, reverb can reuse a large part of it in an AudioWorklet implementation.

The reverb has the larger long-term quality gap, but it should come second because it depends on primitives we do not have yet.

## What “Professional-Grade” Should Mean Here

For Vangelis, professional-grade does not mean copying one famous plugin. It means:

- predictable controls
- audible differences between modes
- smooth live parameter changes
- stable gain structure
- low enough CPU cost for browser playback
- presets that map to real sonic intent
- a UI that supports both fast macro shaping and deeper editing

## Reference Implementations Worth Studying

### Reverb theory and architecture

- Jon Dattorro, *Effect Design Part 1: Reverberator and Other Filters*:
  https://secure.aes.org/forum/pubs/journal/?elib=10160
- Signalsmith Audio, *Let’s Write A Reverb*:
  https://signalsmith-audio.co.uk/writing/2021/lets-write-a-reverb/

Why these matter:

- Dattorro is a classic reference for plate-style algorithmic reverbs.
- Signalsmith gives a modern, practical explanation of early reflections, diffusion, filtering, modulation, and feedback-delay networks. It also argues for at least 8 internal channels for high-quality FDN-style reverb tails.

### Delay and reverb product design

- ValhallaDelay controls:
  https://valhalladsp.com/2019/06/13/valhalladelay-the-controls/
- ValhallaFutureVerb controls:
  https://valhalladsp.com/2025/06/09/valhallafutureverb-the-controls/
- Surge XT manual, Delay / Reverb sections:
  https://surge-synthesizer.github.io/manual-xt

Why these matter:

- ValhallaDelay shows how one effect can expose multiple modes while still feeling learnable.
- ValhallaFutureVerb is useful for seeing how a modern reverb exposes macro controls like density, spread, modulation, early/late balance, and feedback-network shaping.
- Surge XT is a strong open-source benchmark for how a synth exposes delay and reverb parameters in a musician-friendly way.

### Browser/audio platform constraints

- Web Audio API `ConvolverNode`:
  https://www.w3.org/TR/webaudio-1.1/#ConvolverNode
- Web Audio API `AudioWorklet`:
  https://www.w3.org/TR/webaudio-1.1/#AudioWorklet
- Chrome Developers, *Audio worklet design pattern*:
  https://developer.chrome.com/blog/audio-worklet-design-pattern/

Why these matter:

- `ConvolverNode` is great for static spaces and IR playback, but it is not the right foundation for a deeply tweakable algorithmic reverb.
- `AudioWorklet` is the right place for custom real-time DSP in the browser.

## Target Product Direction

### Delay v2

Build delay as an actual effect module with modes and independent parameters.

Core modes:

- Digital
- Tape
- Ping-pong
- Dual
- Diffuse

Core parameters:

- sync on/off
- left time / right time or note division
- feedback
- crossfeed
- low cut
- high cut
- drive
- modulation rate
- modulation depth
- width
- ducking
- mix

Macro view:

- Time
- Feedback
- Tone
- Mix

Advanced view:

- everything else

### Reverb v2

Build algorithmic reverb in an `AudioWorklet`, not as a regenerated `ConvolverNode`.

Core modes:

- Room
- Plate
- Hall
- Ambient / Chaotic

Core parameters:

- pre-delay
- size
- decay / RT60
- early reflection level
- diffusion
- damping
- low cut
- high cut
- modulation rate
- modulation depth
- width
- mix

Possible internal architecture:

- explicit early reflection stage
- diffusion/allpass stages
- 8-channel or larger feedback-delay network for late tail
- damping filters inside the loop
- subtle modulation to reduce metallic ringing

Macro view:

- Size
- Decay
- Tone
- Mix

Advanced view:

- early reflections
- diffusion
- damping
- modulation
- width
- mode-specific parameters

## UI Direction

The current single "Effects" section should become effect modules.

Recommended UI shape:

- one card for Delay
- one card for Reverb
- each card has:
  - enable toggle
  - mode selector
  - four macro controls always visible
  - compact preset selector
  - advanced disclosure

This gives us:

- fast editing for casual use
- deeper control when wanted
- a clean mental model for presets and automation

It also avoids the current problem where one slider secretly changes several unrelated internals.

## Implementation Plan

### Phase 1: Effect parameter model

- Create explicit parameter schemas for delay and reverb.
- Preserve backward compatibility by mapping the existing `delay` and `reverb` values into the new macro parameters.
- Separate macro parameters from advanced parameters.

### Phase 2: Delay rebuild

- Move delay DSP into its own effect module.
- First version can still use native Web Audio nodes if needed, but the target should be an `AudioWorklet` processor with explicit stereo delay lines.
- Add tempo sync, note divisions, feedback, tone controls, width, and ducking.
- Replace the current one-slider UI with macro plus advanced controls.

### Phase 3: Reverb prototype

- Implement a small algorithmic prototype in an `AudioWorklet`.
- Start with early reflections + diffusion + FDN late tail.
- Tune for stability, CPU, and smooth parameter changes before adding more modes.

### Phase 4: Reverb productization

- Add multiple reverb modes with shared macro controls.
- Add presets that map to musical intent, not just engineering terms.
- Tune gain staging so mix and decay feel predictable across modes.

### Phase 5: Presets and polish

- Add factory presets for both effects.
- Add migration for saved sessions.
- Add internal capture tools for listening tests and regression checks.

## Non-Goals For The First Pass

- Do not add a huge matrix of rarely used parameters immediately.
- Do not try to model every vintage unit.
- Do not begin with convolution IR browsing. That can be a separate feature later.
- Do not move all DSP into Rust before the product model is settled.

Browser-side `AudioWorklet` JS is the fastest place to iterate on effect design. Rust/WASM can come later if CPU profiling proves it is needed.

## First Concrete Build Slice

If we start now, the first useful slice should be:

1. Introduce `delay.enabled`, `delay.mode`, `delay.time`, `delay.feedback`, `delay.tone`, `delay.mix`.
2. Replace the current single delay slider with a compact delay card.
3. Keep the current reverb as-is for one iteration.
4. Make delay genuinely tempo-syncable from the current transport context.
5. Add one advanced control set: stereo width, low cut, high cut.

That is small enough to ship, but it establishes the model we need for the reverb rebuild.

## Summary

Start with delay, not because reverb matters less, but because delay is the right foundation.

The current effects are serviceable prototypes. The next step should not be random tuning. It should be a clean effect architecture with explicit parameter models, a macro-plus-advanced UI, and custom DSP where the browser platform actually supports it well.
