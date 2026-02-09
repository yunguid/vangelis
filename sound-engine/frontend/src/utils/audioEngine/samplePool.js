import { AUDIO_PARAM_RANGES, MICRO_FADE_TIME } from '../audioParams.js';
import { MINIMUM_GAIN, VOICE_STATE } from './constants.js';
import { clamp } from '../math.js';

function safeExponentialRamp(param, value, time) {
  const safeValue = Math.max(value, MINIMUM_GAIN);
  try {
    param.exponentialRampToValueAtTime(safeValue, time);
  } catch (e) {
    param.linearRampToValueAtTime(safeValue, time);
  }
}

class SampleVoice {
  constructor(ctx, target, onRecycle) {
    this.ctx = ctx;
    this.target = target;
    this.onRecycle = onRecycle;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(target);

    this.bufferSource = null;
    this.noteId = null;
    this.frequency = 0;
    this.state = VOICE_STATE.IDLE;
    this.startTime = 0;
    this.velocity = 1;
  }

  startSample({ noteId, buffer, frequency, baseFrequency, velocity, params, loop }) {
    this.cleanup();

    const ctx = this.ctx;
    const now = ctx.currentTime;

    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.loop = loop || false;

    if (baseFrequency && frequency) {
      this.bufferSource.playbackRate.value = frequency / baseFrequency;
    }

    this.bufferSource.connect(this.gainNode);

    this.noteId = noteId;
    this.frequency = frequency;
    this.velocity = clamp(velocity, 0, 1);
    this.startTime = now;

    const attack = clamp(params.attack ?? 0.01, AUDIO_PARAM_RANGES.attack.min, AUDIO_PARAM_RANGES.attack.max);
    const decay = clamp(params.decay ?? 0.1, AUDIO_PARAM_RANGES.decay.min, AUDIO_PARAM_RANGES.decay.max);
    const sustain = clamp(params.sustain ?? 0.7, AUDIO_PARAM_RANGES.sustain.min, AUDIO_PARAM_RANGES.sustain.max);
    const useADSR = params.useADSR !== false;
    const targetGain = clamp(params.volume ?? 0.7, AUDIO_PARAM_RANGES.volume.min, AUDIO_PARAM_RANGES.volume.max) * this.velocity;

    const gainParam = this.gainNode.gain;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(MINIMUM_GAIN, now);

    if (!useADSR) {
      safeExponentialRamp(gainParam, targetGain, now + MICRO_FADE_TIME);
    } else {
      safeExponentialRamp(gainParam, targetGain, now + attack);
      if (decay > 0 && sustain < 1) {
        const sustainGain = Math.max(targetGain * sustain, MINIMUM_GAIN);
        safeExponentialRamp(gainParam, sustainGain, now + attack + decay);
      }
    }

    this.state = VOICE_STATE.ATTACK;
    this.bufferSource.start(now);

    this.bufferSource.onended = () => {
      if (!loop) {
        this.cleanup();
        this.onRecycle(this);
      }
    };

    setTimeout(() => {
      if (this.state === VOICE_STATE.ATTACK) {
        this.state = VOICE_STATE.SUSTAIN;
      }
    }, attack * 1000);
  }

  release(releaseTime = 0.3) {
    if (this.state === VOICE_STATE.IDLE || this.state === VOICE_STATE.RELEASE) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const release = clamp(releaseTime, AUDIO_PARAM_RANGES.release.min, AUDIO_PARAM_RANGES.release.max);

    const gainParam = this.gainNode.gain;
    const currentGain = gainParam.value;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(Math.max(currentGain, MINIMUM_GAIN), now);
    safeExponentialRamp(gainParam, MINIMUM_GAIN, now + release);

    this.state = VOICE_STATE.RELEASE;

    const stopTime = now + release + 0.05;

    if (this.bufferSource) {
      try {
        this.bufferSource.stop(stopTime);
      } catch (e) {
        // Ignore
      }
    }

    setTimeout(() => {
      this.cleanup();
      this.onRecycle(this);
    }, (release + 0.1) * 1000);
  }

  stop() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const gainParam = this.gainNode.gain;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(Math.max(gainParam.value, MINIMUM_GAIN), now);
    safeExponentialRamp(gainParam, MINIMUM_GAIN, now + MICRO_FADE_TIME);

    setTimeout(() => {
      this.cleanup();
      this.onRecycle(this);
    }, MICRO_FADE_TIME * 1000 + 50);
  }

  cleanup() {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (e) {
        // Ignore
      }
      this.bufferSource = null;
    }

    this.noteId = null;
    this.state = VOICE_STATE.IDLE;
  }
}

export function createSampleVoicePool({ ctx, inputBus, poolSize }) {
  const voices = [];
  const freeVoices = [];
  const activeVoices = new Map();

  const recycle = (voice) => {
    if (voice.noteId && activeVoices.get(voice.noteId) === voice) {
      activeVoices.delete(voice.noteId);
    }
    voice.noteId = null;

    if (!freeVoices.includes(voice)) {
      freeVoices.push(voice);
    }
  };

  const steal = () => {
    if (!voices.length) return null;

    let candidate = null;
    for (const voice of voices) {
      if (voice.state === VOICE_STATE.IDLE) {
        candidate = voice;
        break;
      }
      if (!candidate || voice.startTime < candidate.startTime) {
        candidate = voice;
      }
    }

    if (candidate) {
      candidate.stop();
      if (candidate.noteId) {
        activeVoices.delete(candidate.noteId);
      }
    }

    return candidate;
  };

  for (let i = 0; i < poolSize; i++) {
    const voice = new SampleVoice(ctx, inputBus, recycle);
    voices.push(voice);
    freeVoices.push(voice);
  }

  const acquire = (noteId) => {
    if (activeVoices.has(noteId)) {
      return activeVoices.get(noteId);
    }

    if (!freeVoices.length) {
      const stolen = steal();
      if (!stolen) return null;
      activeVoices.set(noteId, stolen);
      return stolen;
    }

    const voice = freeVoices.pop();
    activeVoices.set(noteId, voice);
    return voice;
  };

  const release = (noteId, releaseTime) => {
    const voice = activeVoices.get(noteId);
    if (voice) {
      activeVoices.delete(noteId);
      voice.release(releaseTime);
    }
  };

  const releaseAll = (releaseTime) => {
    for (const voice of voices) {
      if (voice.state !== VOICE_STATE.IDLE) {
        voice.release(releaseTime);
      }
    }
  };

  const stopAll = () => {
    for (const voice of voices) {
      if (voice.state !== VOICE_STATE.IDLE) {
        voice.stop();
      }
    }
  };

  return {
    voices,
    acquire,
    release,
    releaseAll,
    stopAll
  };
}
