// AudioWorklet shell for the Vangelis synth: message protocol, voice pool
// management (allocation + stealing), performance-controller smoothing, and
// the master mix/clip stage. All per-sample DSP lives in ./dsp/*.
//
// This file is a Vite worker entry (imported with ?worker&url in
// utils/audioEngine/constants.js) so its imports get bundled into one
// self-contained module for AudioWorklet.addModule.

import { MAX_VOICES, ENV_STAGE, CLIP_KNEE, DEFAULT_PARAMS, clamp } from './dsp/constants.js';
import { Voice } from './dsp/voice.js';

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = sampleRate;
    this.voices = Array.from({ length: MAX_VOICES }, () => new Voice(sampleRate));
    const paramDefaults = options?.processorOptions?.paramDefaults;
    this.params = {
      ...DEFAULT_PARAMS,
      ...(paramDefaults || {})
    };
    this.frameCounter = 0;
    this.lastFrequency = 0; // for glide
    // Performance state (not part of presets)
    this.pitchBendTarget = 0.0; // semitones
    this.pitchBendSmoothed = 0.0;
    this.modWheelTarget = 0.0; // 0..1
    this.modWheelSmoothed = 0.0;
    // ~5ms smoothing for performance controllers
    this.perfSmoothCoeff = Math.exp(-1.0 / (0.005 * sampleRate));
    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      switch (data.type) {
        case 'noteOn':
          this.noteOn(data);
          break;
        case 'noteOff':
          this.noteOff(data.noteId);
          break;
        case 'allNotesOff':
          this.allNotesOff();
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

  noteOn({ noteId, frequency, waveform, velocity }) {
    if (!frequency) return;
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
    // queueStart fades a still-audible voice before restarting it, so steals
    // and same-note retriggers never hard-reset a live phase (no clicks).
    targetVoice.queueStart({
      noteId,
      frequency,
      waveform,
      velocity,
      params: this.params,
      frame: this.frameCounter,
      glideFrom: this.lastFrequency
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
    for (const voice of this.voices) {
      voice.pendingStart = null;
      if (voice.active) {
        voice.release();
      }
    }
  }

  setParams(params) {
    this.params = {
      ...this.params,
      ...params
    };
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

    for (let i = 0; i < frameCount; i++) {
      // Smooth performance controllers
      this.pitchBendSmoothed = this.pitchBendTarget
        + (this.pitchBendSmoothed - this.pitchBendTarget) * this.perfSmoothCoeff;
      this.modWheelSmoothed = this.modWheelTarget
        + (this.modWheelSmoothed - this.modWheelTarget) * this.perfSmoothCoeff;

      const bendMul = (this.pitchBendSmoothed > 0.0005 || this.pitchBendSmoothed < -0.0005)
        ? Math.pow(2, this.pitchBendSmoothed / 12.0)
        : 1.0;

      let sample = 0.0;
      for (const voice of this.voices) {
        if (voice.active) {
          sample += voice.nextSample(bendMul, this.modWheelSmoothed);
        }
      }
      sample *= mixGain;
      // Safety clip only: unity gain below the knee so polyphonic sums stay
      // clean (the old always-on tanh ground held chords into intermodulation
      // mush); C1-continuous exponential knee, asymptote +/-1.
      if (!Number.isFinite(sample)) {
        sample = 0.0;
      } else {
        const mag = Math.abs(sample);
        if (mag > CLIP_KNEE) {
          const clipped = 1.0 - (1.0 - CLIP_KNEE) * Math.exp(-(mag - CLIP_KNEE) / (1.0 - CLIP_KNEE));
          sample = sample < 0 ? -clipped : clipped;
        }
      }
      left[i] = sample;
      if (right) {
        right[i] = sample;
      }
    }

    this.frameCounter += frameCount;
    return true;
  }
}

registerProcessor('vangelis-synth', SynthProcessor);
