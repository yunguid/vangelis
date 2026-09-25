// AudioWorklet shell for the Vangelis synth: message protocol, voice pool
// management (allocation + stealing), performance-controller smoothing, and
// the master mix/clip stage. All per-sample DSP lives in ./dsp/*.
//
// This file is a Vite worker entry (imported with ?worker&url in
// utils/audioEngine/constants.js) so its imports get bundled into one
// self-contained module for AudioWorklet.addModule.

import { MAX_VOICES, ENV_STAGE, CLIP_KNEE, DEFAULT_PARAMS, clamp } from './dsp/constants.js';
import { Voice } from './dsp/voice.js';
import { DCBlocker } from './dsp/dc-blocker.js';
import { compileModRoutes } from './dsp/mod-routes.js';

// Boundary guard: the audio thread must survive a hostile or buggy client.
// Numeric keys accept only finite numbers, booleans coerce, modRoutes must be
// an array, unknown keys drop. Without this, one malformed setParams message
// (e.g. attack: 'abc') poisons the merged param object and permanently
// silences the synth — every voice dies at birth on NaN envelope coefficients
// with no error surfaced anywhere. Range clamping stays downstream in the
// DSP; this guard is about types and finiteness only.
function sanitizeIncomingParams(params, base) {
  const next = { ...base };
  if (!params || typeof params !== 'object') return next;
  for (const key of Object.keys(params)) {
    if (!(key in DEFAULT_PARAMS)) continue;
    const def = DEFAULT_PARAMS[key];
    const value = params[key];
    if (typeof def === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
    } else if (typeof def === 'boolean') {
      next[key] = !!value;
    } else if (Array.isArray(def)) {
      if (Array.isArray(value)) next[key] = value;
    }
  }
  return next;
}

function softClip(sample) {
  if (!Number.isFinite(sample)) return 0.0;
  const mag = Math.abs(sample);
  if (mag <= CLIP_KNEE) return sample;
  const clipped = 1.0 - (1.0 - CLIP_KNEE) * Math.exp(-(mag - CLIP_KNEE) / (1.0 - CLIP_KNEE));
  return sample < 0 ? -clipped : clipped;
}

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = sampleRate;
    const paramDefaults = options?.processorOptions?.paramDefaults;
    this.params = sanitizeIncomingParams(paramDefaults, DEFAULT_PARAMS);
    // Routes compile once per setParams into this shared box; voices hold a
    // reference and never allocate route state themselves (params.lfoRate/
    // lfoDepth/lfoTarget double as the legacy-LFO mapping input).
    this.routesBox = { compiled: compileModRoutes(this.params.modRoutes, this.params) };
    this.voices = Array.from({ length: MAX_VOICES }, () => new Voice(sampleRate, this.routesBox));
    // Timed noteOn/noteOff messages, in frame order, waiting for process() to
    // reach the sample they start on.
    this.events = [];
    // A retired node (a score's part): process() returns false so it can go.
    this.disposed = false;
    this.frameCounter = 0;
    this.lastFrequency = 0; // for glide
    // Performance state (not part of presets)
    this.pitchBendTarget = 0.0; // semitones
    this.pitchBendSmoothed = 0.0;
    this.modWheelTarget = 0.0; // 0..1
    this.modWheelSmoothed = 0.0;
    this.dspValueCache = {
      cutoff: NaN,
      resonance: NaN,
      k: 0.0,
      a1: 0.0,
      a2: 0.0,
      a3: 0.0,
      lfoPhase: NaN,
      lfoValue: 0.0
    };
    // ~5ms smoothing for performance controllers
    this.perfSmoothCoeff = Math.exp(-1.0 / (0.005 * sampleRate));
    // Integer-ratio FM leaves a real 0 Hz component in the voice sum; block it
    // before the clip knee so clipping stays symmetric. One per channel.
    this.dcBlockerL = new DCBlocker(sampleRate);
    this.dcBlockerR = new DCBlocker(sampleRate);
    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      switch (data.type) {
        case 'noteOn':
        case 'noteOff':
          this.schedule(data);
          break;
        case 'allNotesOff':
          this.allNotesOff();
          break;
        case 'dispose':
          this.disposed = true;
          break;
        case 'setParams':
          this.setParams(data.params || {});
          break;
        case 'pitchBend':
          this.pitchBendTarget = clamp(Number(data.value) || 0, -24, 24);
          break;
        case 'modWheel':
          this.modWheelTarget = clamp(Number(data.value) || 0, 0, 1);
          break;
        default:
          break;
      }
    };
  }

  // A message with a `when` (AudioContext seconds) waits for its sample frame;
  // one without, or already due, acts now.
  schedule(data) {
    const timed = Number.isFinite(data.when);
    const frame = timed ? Math.round(data.when * this.sampleRate) : -Infinity;
    const events = this.events;
    if (data.type === 'noteOff') {
      // A note released before its start never starts (nothing would release it).
      let kept = 0;
      for (const event of events) {
        if (event.noteId !== data.noteId || event.type !== 'noteOn' || event.frame <= frame) {
          events[kept++] = event;
        }
      }
      events.length = kept;
    }
    if (timed && frame > currentFrame) {
      data.frame = frame;
      // Frame order; messages for the same frame keep their arrival order.
      let i = events.length;
      events.push(data);
      while (i > 0 && events[i - 1].frame > frame) {
        events[i] = events[i - 1];
        i -= 1;
      }
      events[i] = data;
      return;
    }
    this.dispatch(data);
  }

  dispatch(data) {
    if (data.type === 'noteOn') this.noteOn(data);
    else this.noteOff(data.noteId);
  }

  noteOn({ noteId, frequency, waveform, velocity, expr }) {
    if (!Number.isFinite(frequency) || frequency <= 0) return;
    let targetVoice = null;
    for (const voice of this.voices) {
      if (voice.active && voice.noteId === noteId) {
        targetVoice = voice;
        break;
      }
      if (!voice.active && !targetVoice) {
        targetVoice = voice;
      }
    }
    if (!targetVoice) {
      targetVoice = this.stealVoice();
    }
    if (!targetVoice) return;
    // Legato-only glide (glideMode 1): slide from the previous pitch only
    // while another note is still held — staccato retriggers start on pitch.
    let glideFrom = this.lastFrequency;
    if (this.params.glideMode === 1) {
      let held = false;
      for (const voice of this.voices) {
        if (voice.active && voice.noteId !== noteId
          && voice.envelope.stage !== ENV_STAGE.RELEASE) {
          held = true;
          break;
        }
      }
      if (!held) glideFrom = 0; // Voice.start treats 0 as "no glide source"
    }
    // queueStart fades a still-audible voice before restarting it, so steals
    // and same-note retriggers never hard-reset a live phase (no clicks).
    targetVoice.queueStart({
      noteId,
      frequency,
      waveform,
      velocity,
      params: this.params,
      frame: this.frameCounter,
      glideFrom,
      expr
    });
    this.lastFrequency = frequency;
  }

  noteOff(noteId) {
    if (!noteId) return;
    for (const voice of this.voices) {
      // A note released while still queued behind a steal fade must never
      // start: cancelling here is its noteOff (otherwise it rings forever).
      if (voice.pendingStart && voice.pendingStart.noteId === noteId) {
        voice.pendingStart = null;
      }
      if (voice.active && voice.noteId === noteId) {
        voice.release();
      }
    }
  }

  allNotesOff() {
    this.events.length = 0;
    for (const voice of this.voices) {
      voice.pendingStart = null;
      if (voice.active) {
        voice.release();
      }
    }
  }

  setParams(params) {
    this.params = sanitizeIncomingParams(params, this.params);
    this.routesBox.compiled = compileModRoutes(this.params.modRoutes, this.params);
    for (const voice of this.voices) {
      voice.updateParams(this.params);
    }
  }

  stealVoice() {
    let candidate = null;
    let candidateScore = Infinity;

    for (const voice of this.voices) {
      // Score voices: lower is better to steal
      // Prefer: releasing > oldest > loudest
      let score = 0;

      // A voice already fading toward a queued note is the worst candidate:
      // re-stealing it would silently drop that queued note.
      if (voice.pendingStart) {
        score += 200000;
      }

      // Voices in release phase are best candidates
      if (voice.envelope.stage === ENV_STAGE.RELEASE) {
        score -= 100000;
      }

      // Older voices are better candidates
      score -= (this.frameCounter - voice.startFrame);

      // Quieter voices are better candidates
      score -= (1.0 - voice.envelope.value) * 10000;

      if (score < candidateScore) {
        candidateScore = score;
        candidate = voice;
      }
    }

    // Caller queues the note via queueStart, which fades the stolen voice
    // out before restarting it.
    return candidate;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const frameCount = left.length;
    const mixGain = 0.2;
    const events = this.events;

    for (let i = 0; i < frameCount; i++) {
      // Timed messages act at the start of the sample they fall on
      while (events.length > 0 && events[0].frame <= currentFrame + i) {
        this.dispatch(events.shift());
      }
      // Smooth performance controllers
      this.pitchBendSmoothed = this.pitchBendTarget
        + (this.pitchBendSmoothed - this.pitchBendTarget) * this.perfSmoothCoeff;
      this.modWheelSmoothed = this.modWheelTarget
        + (this.modWheelSmoothed - this.modWheelTarget) * this.perfSmoothCoeff;

      const bendMul = (this.pitchBendSmoothed > 0.0005 || this.pitchBendSmoothed < -0.0005)
        ? Math.pow(2, this.pitchBendSmoothed / 12.0)
        : 1.0;

      let sumL = 0.0;
      let sumR = 0.0;
      for (const voice of this.voices) {
        if (voice.active) {
          voice.nextSample(bendMul, this.modWheelSmoothed, this.dspValueCache);
          sumL += voice.outL;
          sumR += voice.outR;
        }
      }
      sumL = this.dcBlockerL.process(sumL) * mixGain;
      sumR = this.dcBlockerR.process(sumR) * mixGain;
      // Safety clip only: unity gain below the knee so polyphonic sums stay
      // clean (the old always-on tanh ground held chords into intermodulation
      // mush); C1-continuous exponential knee, asymptote +/-1.
      left[i] = softClip(sumL);
      if (right) {
        right[i] = right === left ? left[i] : softClip(sumR);
      }
    }

    this.frameCounter += frameCount;
    return !this.disposed;
  }
}

registerProcessor('vangelis-synth', SynthProcessor);
