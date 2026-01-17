import { RECORDER_PROCESSOR, RECORDER_URL } from './constants.js';
import { encodeWav, flattenBuffers } from './wav.js';

export class RecorderController {
  constructor({ onStop } = {}) {
    this.onStop = onStop;
    this.node = null;
    this.gain = null;
    this.readyPromise = null;
    this.recordedLeft = [];
    this.recordedRight = [];
    this.pendingStop = false;
    this.isRecording = false;
  }

  async ensure(ctx, nodes) {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(RECORDER_URL);

      this.node = new AudioWorkletNode(ctx, RECORDER_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      this.gain = ctx.createGain();
      this.gain.gain.value = 0;

      nodes.stereoPanner.connect(this.node);
      this.node.connect(this.gain);
      this.gain.connect(ctx.destination);

      this.node.port.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;
        if (data.type === 'data') {
          if (!this.isRecording) return;
          this.recordedLeft.push(data.left);
          this.recordedRight.push(data.right);
        } else if (data.type === 'stopped') {
          if (this.pendingStop) {
            this.pendingStop = false;
            if (this.onStop) {
              this.onStop();
            }
          }
        }
      };
    })();

    return this.readyPromise;
  }

  start() {
    if (!this.node) return;
    this.recordedLeft = [];
    this.recordedRight = [];
    this.pendingStop = false;
    this.node.port.postMessage({ type: 'start' });
    this.isRecording = true;
  }

  stop() {
    if (!this.node) return;
    this.pendingStop = true;
    this.node.port.postMessage({ type: 'stop' });
    this.isRecording = false;
  }

  exportWav(sampleRate) {
    const left = flattenBuffers(this.recordedLeft);
    const right = flattenBuffers(this.recordedRight);
    if (!left || left.length === 0) return null;
    const wavBuffer = encodeWav(left, right, sampleRate);
    this.recordedLeft = [];
    this.recordedRight = [];
    return wavBuffer;
  }
}
