import {
  DELAY_WORKLET_PROCESSOR,
  DELAY_WORKLET_URL,
  REVERB_WORKLET_PROCESSOR,
  REVERB_WORKLET_URL,
  WORKLET_PROCESSOR,
  WORKLET_URL
} from './constants.js';

export const DELAY_WORKLET_DEFAULTS = {
  enabled: false,
  inputLeft: 1,
  inputRight: 1,
  timeLeft: 0.12,
  timeRight: 0.17,
  feedback: 0.25,
  crossfeed: 0,
  lowCut: 90,
  highCut: 5400,
  drive: 0.02,
  modRate: 0.14,
  modDepth: 0.0001,
  flutterRate: 4,
  flutterDepth: 0.00002,
  width: 0.7,
  ducking: 0.12,
  duckRelease: 0.18
};

export const REVERB_WORKLET_DEFAULTS = {
  enabled: false,
  variant: 'hall',
  preDelay: 0.018,
  size: 0.58,
  decay: 0.52,
  damping: 0.42,
  lowCut: 120,
  highCut: 9200,
  width: 0.82,
  diffusion: 0.72,
  modRate: 0.16,
  modDepth: 0.0004,
  earlyLevel: 0.34
};

export class SynthWorklet {
  constructor(paramDefaults) {
    this.node = null;
    this.readyPromise = null;
    this.ready = false;
    this.paramDefaults = paramDefaults;
    this.lastParams = { ...paramDefaults };
  }

  async ensure(ctx, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, WORKLET_PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      this.node.connect(destination);
      this.ready = true;
      this.setParams(this.lastParams);
    })().catch((err) => {
      this.node = null;
      this.ready = false;
      this.readyPromise = null;
      throw err;
    });

    return this.readyPromise;
  }

  setParams(params) {
    this.lastParams = { ...this.lastParams, ...params };
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'setParams',
      params: this.lastParams
    });
  }

  noteOn({ noteId, frequency, waveform, velocity }) {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'noteOn',
      noteId,
      frequency,
      waveform,
      velocity
    });
  }

  noteOff(noteId) {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'noteOff',
      noteId
    });
  }

  allNotesOff() {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'allNotesOff'
    });
  }
}

class BaseEffectWorklet {
  constructor(paramDefaults) {
    this.node = null;
    this.readyPromise = null;
    this.ready = false;
    this.paramDefaults = paramDefaults;
    this.lastParams = { ...paramDefaults };
  }

  setParams(params) {
    this.lastParams = { ...this.lastParams, ...params };
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'setParams',
      params: this.lastParams
    });
  }

  clear() {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'clear' });
  }
}

export class DelayWorklet extends BaseEffectWorklet {
  async ensure(ctx, source, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(DELAY_WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, DELAY_WORKLET_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      source.connect(this.node);
      this.node.connect(destination);
      this.ready = true;
      this.setParams(this.lastParams);
    })().catch((err) => {
      this.node = null;
      this.ready = false;
      this.readyPromise = null;
      throw err;
    });

    return this.readyPromise;
  }
}

export class ReverbWorklet extends BaseEffectWorklet {
  async ensure(ctx, source, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(REVERB_WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, REVERB_WORKLET_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      source.connect(this.node);
      this.node.connect(destination);
      this.ready = true;
      this.setParams(this.lastParams);
    })().catch((err) => {
      this.node = null;
      this.ready = false;
      this.readyPromise = null;
      throw err;
    });

    return this.readyPromise;
  }
}
