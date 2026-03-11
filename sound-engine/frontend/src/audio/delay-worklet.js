const TWO_PI = Math.PI * 2;

const DEFAULT_DELAY_PARAMS = {
  enabled: false,
  inputLeft: 1.0,
  inputRight: 1.0,
  timeLeft: 0.12,
  timeRight: 0.17,
  feedback: 0.25,
  crossfeed: 0.0,
  lowCut: 90,
  highCut: 5400,
  drive: 0.02,
  modRate: 0.14,
  modDepth: 0.0001,
  flutterRate: 4.0,
  flutterDepth: 0.00002,
  width: 0.7,
  ducking: 0.12,
  duckRelease: 0.18
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class ToneFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.lowCut = 90;
    this.highCut = 5400;
    this.targetLowCut = 90;
    this.targetHighCut = 5400;
    this.highpassState = 0.0;
    this.lowpassState = 0.0;
    this.smooth = 0.004;
  }

  setCutoffs(lowCut, highCut) {
    this.targetLowCut = clamp(lowCut, 20, 4000);
    this.targetHighCut = clamp(highCut, this.targetLowCut + 200, this.sampleRate * 0.45);
  }

  reset() {
    this.highpassState = 0.0;
    this.lowpassState = 0.0;
    this.lowCut = this.targetLowCut;
    this.highCut = this.targetHighCut;
  }

  process(input) {
    this.lowCut += (this.targetLowCut - this.lowCut) * this.smooth;
    this.highCut += (this.targetHighCut - this.highCut) * this.smooth;

    const hpAlpha = 1 - Math.exp((-TWO_PI * this.lowCut) / this.sampleRate);
    this.highpassState += hpAlpha * (input - this.highpassState);
    const highpassed = input - this.highpassState;

    const lpAlpha = 1 - Math.exp((-TWO_PI * this.highCut) / this.sampleRate);
    this.lowpassState += lpAlpha * (highpassed - this.lowpassState);
    return this.lowpassState;
  }
}

class DelayProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();

    this.maxDelaySeconds = 4.5;
    this.bufferLength = Math.ceil(sampleRate * this.maxDelaySeconds) + 4;
    this.leftBuffer = new Float32Array(this.bufferLength);
    this.rightBuffer = new Float32Array(this.bufferLength);
    this.writeIndex = 0;
    this.modPhase = 0.0;
    this.flutterPhase = 0.0;
    this.duckEnvelope = 0.0;
    this.duckAttack = 1 - Math.exp(-1 / (sampleRate * 0.012));

    const paramDefaults = options.processorOptions?.paramDefaults || DEFAULT_DELAY_PARAMS;
    this.params = { ...DEFAULT_DELAY_PARAMS, ...paramDefaults };
    this.current = { ...this.params };

    this.leftTone = new ToneFilter(sampleRate);
    this.rightTone = new ToneFilter(sampleRate);
    this.leftTone.setCutoffs(this.params.lowCut, this.params.highCut);
    this.rightTone.setCutoffs(this.params.lowCut, this.params.highCut);

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'setParams' && data.params) {
        const nextParams = { ...this.params, ...data.params };
        const wasEnabled = this.params.enabled;
        this.params = nextParams;
        if (wasEnabled && nextParams.enabled === false) {
          this.clear();
        }
        this.leftTone.setCutoffs(nextParams.lowCut, nextParams.highCut);
        this.rightTone.setCutoffs(nextParams.lowCut, nextParams.highCut);
      }

      if (data.type === 'clear') {
        this.clear();
      }
    };
  }

  clear() {
    this.leftBuffer.fill(0);
    this.rightBuffer.fill(0);
    this.writeIndex = 0;
    this.modPhase = 0.0;
    this.flutterPhase = 0.0;
    this.leftTone.reset();
    this.rightTone.reset();
    this.duckEnvelope = 0.0;
  }

  smoothParam(name, factor = 0.01) {
    this.current[name] += (this.params[name] - this.current[name]) * factor;
    return this.current[name];
  }

  readInterpolated(buffer, delaySamples) {
    let readIndex = this.writeIndex - delaySamples;
    while (readIndex < 0) {
      readIndex += this.bufferLength;
    }

    const indexA = Math.floor(readIndex);
    const indexB = (indexA + 1) % this.bufferLength;
    const frac = readIndex - indexA;
    const sampleA = buffer[indexA];
    const sampleB = buffer[indexB];
    return sampleA + (sampleB - sampleA) * frac;
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    const inputLeft = input[0];
    const inputRight = input[1] || input[0];
    const outputLeft = output[0];
    const outputRight = output[1];

    if (!outputLeft || !outputRight) {
      return true;
    }

    const frameCount = outputLeft.length;

    for (let i = 0; i < frameCount; i += 1) {
      const enabled = this.params.enabled === true;
      const timeLeft = clamp(this.smoothParam('timeLeft', 0.004), 0.02, this.maxDelaySeconds);
      const timeRight = clamp(this.smoothParam('timeRight', 0.004), 0.02, this.maxDelaySeconds);
      const feedback = clamp(this.smoothParam('feedback', 0.01), 0, 0.96);
      const crossfeed = clamp(this.smoothParam('crossfeed', 0.01), 0, 0.96);
      const drive = clamp(this.smoothParam('drive', 0.01), 0, 0.4);
      const modRate = clamp(this.smoothParam('modRate', 0.01), 0.01, 4);
      const modDepth = clamp(this.smoothParam('modDepth', 0.01), 0, 0.01);
      const flutterRate = clamp(this.smoothParam('flutterRate', 0.01), 0.1, 12);
      const flutterDepth = clamp(this.smoothParam('flutterDepth', 0.01), 0, 0.01);
      const width = clamp(this.smoothParam('width', 0.01), 0, 1);
      const ducking = clamp(this.smoothParam('ducking', 0.015), 0, 1);
      const duckReleaseTime = clamp(this.smoothParam('duckRelease', 0.015), 0.04, 0.8);
      const leftInputGain = clamp(this.smoothParam('inputLeft', 0.01), 0, 1.2);
      const rightInputGain = clamp(this.smoothParam('inputRight', 0.01), 0, 1.2);

      this.leftTone.setCutoffs(
        this.smoothParam('lowCut', 0.01),
        this.smoothParam('highCut', 0.01)
      );
      this.rightTone.setCutoffs(
        this.current.lowCut * 1.03,
        Math.max(this.current.highCut * 0.97, this.current.lowCut + 300)
      );

      this.modPhase += modRate / sampleRate;
      if (this.modPhase >= 1.0) {
        this.modPhase -= 1.0;
      }
      this.flutterPhase += flutterRate / sampleRate;
      if (this.flutterPhase >= 1.0) {
        this.flutterPhase -= 1.0;
      }

      const modLeft = Math.sin(TWO_PI * this.modPhase) * modDepth;
      const modRight = Math.sin(TWO_PI * (this.modPhase + 0.25)) * modDepth * 0.92;
      const flutterLeft = (
        Math.sin(TWO_PI * this.flutterPhase)
        + 0.35 * Math.sin(TWO_PI * (this.flutterPhase * 1.91 + 0.19))
      ) * flutterDepth * 0.72;
      const flutterRight = (
        Math.sin(TWO_PI * (this.flutterPhase + 0.18))
        + 0.28 * Math.sin(TWO_PI * (this.flutterPhase * 2.11 + 0.63))
      ) * flutterDepth * 0.68;
      const delaySamplesLeft = clamp((timeLeft + modLeft + flutterLeft) * sampleRate, 1, this.bufferLength - 3);
      const delaySamplesRight = clamp((timeRight - modRight + flutterRight) * sampleRate, 1, this.bufferLength - 3);

      const rawDelayLeft = this.readInterpolated(this.leftBuffer, delaySamplesLeft);
      const rawDelayRight = this.readInterpolated(this.rightBuffer, delaySamplesRight);
      const wetLeft = this.leftTone.process(rawDelayLeft);
      const wetRight = this.rightTone.process(rawDelayRight);

      const feedbackDrive = 1 + drive * 7;
      const feedbackLeft = Math.tanh((wetLeft * feedback + wetRight * crossfeed) * feedbackDrive);
      const feedbackRight = Math.tanh((wetRight * feedback + wetLeft * crossfeed) * feedbackDrive);

      const dryLeft = inputLeft?.[i] || 0;
      const dryRight = inputRight?.[i] || 0;
      const detector = clamp(Math.max(Math.abs(dryLeft), Math.abs(dryRight)) * 8, 0, 1);
      const duckRelease = 1 - Math.exp(-1 / (sampleRate * duckReleaseTime));
      const duckSmoothing = detector > this.duckEnvelope ? this.duckAttack : duckRelease;
      this.duckEnvelope += (detector - this.duckEnvelope) * duckSmoothing;

      const sourceLeft = dryLeft * leftInputGain;
      const sourceRight = dryRight * rightInputGain;
      this.leftBuffer[this.writeIndex] = clamp(sourceLeft + feedbackLeft, -1.2, 1.2);
      this.rightBuffer[this.writeIndex] = clamp(sourceRight + feedbackRight, -1.2, 1.2);

      this.writeIndex += 1;
      if (this.writeIndex >= this.bufferLength) {
        this.writeIndex = 0;
      }

      if (!enabled) {
        outputLeft[i] = 0;
        outputRight[i] = 0;
        continue;
      }

      const stereoSide = (wetLeft - wetRight) * (0.38 + width * 0.82) * 0.5;
      const stereoMid = (wetLeft + wetRight) * 0.5;
      const wetGain = clamp(1 - this.duckEnvelope * ducking * 0.85, 0.18, 1);
      outputLeft[i] = (stereoMid + stereoSide) * wetGain;
      outputRight[i] = (stereoMid - stereoSide) * wetGain;
    }

    return true;
  }
}

registerProcessor('vangelis-delay', DelayProcessor);
