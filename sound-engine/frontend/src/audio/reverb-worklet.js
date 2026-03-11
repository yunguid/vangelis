const TWO_PI = Math.PI * 2;
const MAX_PRE_DELAY_SECONDS = 0.2;
const MAX_LINE_SECONDS = 1.4;

const DEFAULT_REVERB_PARAMS = {
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

const REVERB_VARIANTS = {
  room: {
    lines: [0.0211, 0.0257, 0.0313, 0.0361],
    diffusers: [0.0041, 0.0068],
    earlyLeft: [0.0042, 0.0087, 0.0134],
    earlyRight: [0.0058, 0.0106, 0.0161],
    inputMatrix: [1.0, 0.72, -0.56, 0.41],
    feedbackBase: 0.42,
    feedbackSpan: 0.3,
    sizeScale: 0.62,
    outputGain: 0.34,
    modSigns: [1, -1, 0.7, -0.8]
  },
  plate: {
    lines: [0.0277, 0.0331, 0.0379, 0.0417],
    diffusers: [0.0053, 0.0094],
    earlyLeft: [0.0056, 0.0118, 0.0172],
    earlyRight: [0.0079, 0.0141, 0.0196],
    inputMatrix: [1.0, 0.76, -0.48, 0.54],
    feedbackBase: 0.46,
    feedbackSpan: 0.36,
    sizeScale: 0.78,
    outputGain: 0.32,
    modSigns: [0.8, -1, 0.65, -0.72]
  },
  hall: {
    lines: [0.0353, 0.0419, 0.0487, 0.0561],
    diffusers: [0.0064, 0.0117],
    earlyLeft: [0.0071, 0.0149, 0.0226],
    earlyRight: [0.0092, 0.0178, 0.0264],
    inputMatrix: [1.0, 0.68, -0.58, 0.47],
    feedbackBase: 0.52,
    feedbackSpan: 0.39,
    sizeScale: 0.96,
    outputGain: 0.29,
    modSigns: [1, -0.8, 0.6, -0.5]
  },
  ambient: {
    lines: [0.047, 0.0583, 0.071, 0.0831],
    diffusers: [0.0091, 0.0154],
    earlyLeft: [0.011, 0.0218, 0.0324],
    earlyRight: [0.0142, 0.0261, 0.0382],
    inputMatrix: [1.0, 0.62, -0.64, 0.56],
    feedbackBase: 0.61,
    feedbackSpan: 0.29,
    sizeScale: 1.18,
    outputGain: 0.25,
    modSigns: [1, -1, 1.12, -0.92]
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class ToneFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.lowCut = 120;
    this.highCut = 9200;
    this.targetLowCut = 120;
    this.targetHighCut = 9200;
    this.highpassState = 0.0;
    this.lowpassState = 0.0;
    this.smooth = 0.004;
  }

  setCutoffs(lowCut, highCut) {
    this.targetLowCut = clamp(lowCut, 20, 4000);
    this.targetHighCut = clamp(highCut, this.targetLowCut + 300, this.sampleRate * 0.46);
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

class TapBuffer {
  constructor(length) {
    this.length = length;
    this.buffer = new Float32Array(length);
    this.writeIndex = 0;
  }

  clear() {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }

  read(delaySamples) {
    let readIndex = this.writeIndex - delaySamples;
    while (readIndex < 0) {
      readIndex += this.length;
    }

    const indexA = Math.floor(readIndex);
    const indexB = (indexA + 1) % this.length;
    const frac = readIndex - indexA;
    const sampleA = this.buffer[indexA];
    const sampleB = this.buffer[indexB];
    return sampleA + (sampleB - sampleA) * frac;
  }

  write(sample) {
    this.buffer[this.writeIndex] = sample;
    this.writeIndex += 1;
    if (this.writeIndex >= this.length) {
      this.writeIndex = 0;
    }
  }
}

class Diffuser extends TapBuffer {
  process(input, delaySamples, feedback) {
    const delayed = this.read(delaySamples);
    const output = delayed - input * feedback;
    this.write(input + delayed * feedback);
    return output;
  }
}

class ReverbProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();

    const paramDefaults = options.processorOptions?.paramDefaults || DEFAULT_REVERB_PARAMS;
    this.params = { ...DEFAULT_REVERB_PARAMS, ...paramDefaults };
    this.current = { ...this.params };
    this.variant = REVERB_VARIANTS[this.params.variant] || REVERB_VARIANTS.hall;

    this.preDelay = new TapBuffer(Math.ceil(sampleRate * MAX_PRE_DELAY_SECONDS) + 4);
    this.diffuserA = new Diffuser(Math.ceil(sampleRate * 0.03) + 4);
    this.diffuserB = new Diffuser(Math.ceil(sampleRate * 0.04) + 4);
    this.lines = Array.from({ length: 4 }, () => ({
      buffer: new TapBuffer(Math.ceil(sampleRate * MAX_LINE_SECONDS) + 4),
      dampingState: 0
    }));

    this.leftTone = new ToneFilter(sampleRate);
    this.rightTone = new ToneFilter(sampleRate);
    this.leftTone.setCutoffs(this.params.lowCut, this.params.highCut);
    this.rightTone.setCutoffs(this.params.lowCut, this.params.highCut);

    this.modPhase = 0.0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'setParams' && data.params) {
        const nextParams = { ...this.params, ...data.params };
        const variantChanged = nextParams.variant !== this.params.variant;
        const wasEnabled = this.params.enabled;
        this.params = nextParams;
        this.variant = REVERB_VARIANTS[nextParams.variant] || REVERB_VARIANTS.hall;
        this.leftTone.setCutoffs(nextParams.lowCut, nextParams.highCut);
        this.rightTone.setCutoffs(nextParams.lowCut, nextParams.highCut);

        if ((wasEnabled && nextParams.enabled === false) || variantChanged) {
          this.clear();
        }
      }

      if (data.type === 'clear') {
        this.clear();
      }
    };
  }

  clear() {
    this.preDelay.clear();
    this.diffuserA.clear();
    this.diffuserB.clear();
    for (const line of this.lines) {
      line.buffer.clear();
      line.dampingState = 0;
    }
    this.leftTone.reset();
    this.rightTone.reset();
    this.modPhase = 0.0;
  }

  smoothParam(name, factor = 0.01) {
    if (typeof this.current[name] !== 'number' || typeof this.params[name] !== 'number') {
      return this.params[name];
    }
    this.current[name] += (this.params[name] - this.current[name]) * factor;
    return this.current[name];
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
      const size = clamp(this.smoothParam('size', 0.01), 0, 1);
      const decay = clamp(this.smoothParam('decay', 0.01), 0, 1);
      const damping = clamp(this.smoothParam('damping', 0.01), 0.05, 0.97);
      const preDelaySeconds = clamp(this.smoothParam('preDelay', 0.01), 0, MAX_PRE_DELAY_SECONDS);
      const width = clamp(this.smoothParam('width', 0.01), 0, 1);
      const diffusion = clamp(this.smoothParam('diffusion', 0.01), 0.25, 0.98);
      const modRate = clamp(this.smoothParam('modRate', 0.01), 0.02, 1.5);
      const modDepth = clamp(this.smoothParam('modDepth', 0.01), 0, 0.003);
      const earlyLevel = clamp(this.smoothParam('earlyLevel', 0.01), 0, 1);
      const lowCut = clamp(this.smoothParam('lowCut', 0.01), 20, 4000);
      const highCut = clamp(this.smoothParam('highCut', 0.01), lowCut + 300, sampleRate * 0.46);

      this.leftTone.setCutoffs(lowCut, highCut);
      this.rightTone.setCutoffs(lowCut * 1.04, Math.max(highCut * 0.97, lowCut + 400));

      this.modPhase += modRate / sampleRate;
      if (this.modPhase >= 1.0) {
        this.modPhase -= 1.0;
      }

      const dryLeft = inputLeft?.[i] || 0;
      const dryRight = inputRight?.[i] || 0;
      const monoInput = (dryLeft + dryRight) * 0.5;

      const preDelayed = this.preDelay.read(preDelaySeconds * sampleRate);
      this.preDelay.write(monoInput);

      const sizeScale = 0.72 + size * this.variant.sizeScale;
      const diffuserAOut = this.diffuserA.process(
        preDelayed,
        this.variant.diffusers[0] * (0.78 + size * 0.46) * sampleRate,
        0.54 + diffusion * 0.22
      );
      const diffuserBOut = this.diffuserB.process(
        diffuserAOut,
        this.variant.diffusers[1] * (0.8 + size * 0.52) * sampleRate,
        0.5 + diffusion * 0.24
      );

      const modA = Math.sin(TWO_PI * this.modPhase);
      const modB = Math.sin(TWO_PI * (this.modPhase + 0.31));
      const feedback = clamp(
        this.variant.feedbackBase + decay * this.variant.feedbackSpan,
        0.35,
        0.95
      );

      const line0 = this.lines[0];
      const line1 = this.lines[1];
      const line2 = this.lines[2];
      const line3 = this.lines[3];

      const delay0 = clamp(this.variant.lines[0] * sizeScale + modDepth * this.variant.modSigns[0] * modA, 0.008, MAX_LINE_SECONDS);
      const delay1 = clamp(this.variant.lines[1] * sizeScale + modDepth * this.variant.modSigns[1] * modB, 0.008, MAX_LINE_SECONDS);
      const delay2 = clamp(this.variant.lines[2] * sizeScale + modDepth * this.variant.modSigns[2] * modA, 0.008, MAX_LINE_SECONDS);
      const delay3 = clamp(this.variant.lines[3] * sizeScale + modDepth * this.variant.modSigns[3] * modB, 0.008, MAX_LINE_SECONDS);

      const damped0 = line0.dampingState = line0.buffer.read(delay0 * sampleRate) * (1 - damping) + line0.dampingState * damping;
      const damped1 = line1.dampingState = line1.buffer.read(delay1 * sampleRate) * (1 - damping) + line1.dampingState * damping;
      const damped2 = line2.dampingState = line2.buffer.read(delay2 * sampleRate) * (1 - damping) + line2.dampingState * damping;
      const damped3 = line3.dampingState = line3.buffer.read(delay3 * sampleRate) * (1 - damping) + line3.dampingState * damping;

      const sum = damped0 + damped1 + damped2 + damped3;
      line0.buffer.write(diffuserBOut * this.variant.inputMatrix[0] + (sum * 0.5 - damped0) * feedback);
      line1.buffer.write(diffuserBOut * this.variant.inputMatrix[1] + (sum * 0.5 - damped1) * feedback);
      line2.buffer.write(diffuserBOut * this.variant.inputMatrix[2] + (sum * 0.5 - damped2) * feedback);
      line3.buffer.write(diffuserBOut * this.variant.inputMatrix[3] + (sum * 0.5 - damped3) * feedback);

      const earlyLeft = earlyLevel * (
        this.preDelay.read(this.variant.earlyLeft[0] * sizeScale * sampleRate) * 0.52
        + this.preDelay.read(this.variant.earlyLeft[1] * sizeScale * sampleRate) * 0.31
        + this.preDelay.read(this.variant.earlyLeft[2] * sizeScale * sampleRate) * 0.17
      );
      const earlyRight = earlyLevel * (
        this.preDelay.read(this.variant.earlyRight[0] * sizeScale * sampleRate) * 0.52
        + this.preDelay.read(this.variant.earlyRight[1] * sizeScale * sampleRate) * 0.31
        + this.preDelay.read(this.variant.earlyRight[2] * sizeScale * sampleRate) * 0.17
      );

      const wetLeft = this.leftTone.process(
        earlyLeft + (damped0 + damped1 - damped2 - damped3) * this.variant.outputGain
      );
      const wetRight = this.rightTone.process(
        earlyRight + (damped0 - damped1 + damped2 - damped3) * this.variant.outputGain
      );

      if (!enabled) {
        outputLeft[i] = 0;
        outputRight[i] = 0;
        continue;
      }

      const stereoMid = (wetLeft + wetRight) * 0.5;
      const stereoSide = (wetLeft - wetRight) * (0.32 + width * 0.86) * 0.5;
      outputLeft[i] = stereoMid + stereoSide;
      outputRight[i] = stereoMid - stereoSide;
    }

    return true;
  }
}

registerProcessor('vangelis-reverb', ReverbProcessor);
