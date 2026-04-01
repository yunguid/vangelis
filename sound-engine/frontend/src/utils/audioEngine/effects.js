import {
  AUDIO_PARAM_DEFAULTS,
  getDelaySeconds,
  toWorkletParams
} from '../audioParams.js';
import { clamp } from '../math.js';

export class DistortionCurveCache {
  constructor(resolution = 44100) {
    this.resolution = resolution;
    this.cache = new Map();
  }

  get(amount) {
    const normalized = clamp(amount ?? 0, 0, 1);
    const key = Math.round(normalized * 1000) / 1000;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const curve = new Float32Array(this.resolution);
    if (key === 0) {
      for (let i = 0; i < this.resolution; i++) {
        curve[i] = (i * 2) / this.resolution - 1;
      }
    } else {
      const k = key * 150;
      const deg = Math.PI / 180;
      for (let i = 0; i < this.resolution; i++) {
        const x = (i * 2) / this.resolution - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }

    this.cache.set(key, curve);
    return curve;
  }
}

const DELAY_MODE_CONFIG = {
  digital: {
    inputLeft: 1,
    inputRight: 1,
    localFeedback: 1,
    crossFeedback: 0,
    spread: 0.14,
    modulationRate: 0.12,
    modulationDepth: 0.00008,
    drive: 0.015,
    ageDrive: 0.05,
    ageHighCutDrop: 0.18,
    ageLowCutLift: 60,
    flutterAmount: 0.18,
    flutterRate: 3.8,
    duckRelease: 0.14
  },
  tape: {
    inputLeft: 1,
    inputRight: 0.94,
    localFeedback: 0.84,
    crossFeedback: 0.12,
    spread: 0.18,
    modulationRate: 0.18,
    modulationDepth: 0.00034,
    drive: 0.08,
    ageDrive: 0.18,
    ageHighCutDrop: 0.52,
    ageLowCutLift: 180,
    flutterAmount: 0.92,
    flutterRate: 5.6,
    duckRelease: 0.24
  },
  'ping-pong': {
    inputLeft: 1,
    inputRight: 0.2,
    localFeedback: 0.12,
    crossFeedback: 0.84,
    spread: 0.24,
    modulationRate: 0.15,
    modulationDepth: 0.00018,
    drive: 0.04,
    ageDrive: 0.09,
    ageHighCutDrop: 0.28,
    ageLowCutLift: 100,
    flutterAmount: 0.42,
    flutterRate: 4.5,
    duckRelease: 0.18
  }
};

const REVERB_MODE_CONFIG = {
  room: {
    sendScale: 0.46,
    wetScale: 0.58,
    dampingOffset: 0.06,
    toneOffset: -0.06,
    diffusion: 0.62,
    modRate: 0.11,
    modDepth: 0.00018,
    earlyLevel: 0.46,
    widthBias: 0.08
  },
  plate: {
    sendScale: 0.5,
    wetScale: 0.62,
    dampingOffset: 0.02,
    toneOffset: 0.04,
    diffusion: 0.76,
    modRate: 0.14,
    modDepth: 0.00028,
    earlyLevel: 0.32,
    widthBias: 0.14
  },
  hall: {
    sendScale: 0.54,
    wetScale: 0.68,
    dampingOffset: 0,
    toneOffset: 0,
    diffusion: 0.82,
    modRate: 0.16,
    modDepth: 0.00042,
    earlyLevel: 0.28,
    widthBias: 0.18
  },
  ambient: {
    sendScale: 0.58,
    wetScale: 0.74,
    dampingOffset: -0.08,
    toneOffset: 0.08,
    diffusion: 0.9,
    modRate: 0.19,
    modDepth: 0.00058,
    earlyLevel: 0.22,
    widthBias: 0.24
  }
};

export function paramsSignature(params) {
  return Object.values(params).map((value) =>
    typeof value === 'number' ? value.toFixed(4) : String(value)
  ).join('|');
}

export function applyGlobalParams({
  params,
  transportTempoBpm,
  ctx,
  nodes,
  distortionCache,
  delayWorklet,
  reverbWorklet,
  synthWorklet
}) {
  const now = ctx.currentTime;

  nodes.masterGain.gain.cancelScheduledValues(now);
  nodes.masterGain.gain.setTargetAtTime(params.volume * 0.94, now, 0.02);

  const delayMode = DELAY_MODE_CONFIG[params.delayMode]
    ? params.delayMode
    : AUDIO_PARAM_DEFAULTS.delayMode;
  const delayConfig = DELAY_MODE_CONFIG[delayMode];
  const delayActive = params.delayEnabled && params.delayMix > 0.001;
  const delayAge = params.delayAge;
  const delayMotion = params.delayMotion;
  const delaySeconds = getDelaySeconds(params, transportTempoBpm);
  const stereoSpread = 0.015 + params.delayStereo * delayConfig.spread;
  const leftDelayTime = clamp(delaySeconds * (1 - stereoSpread), 0.02, 4);
  const rightDelayTime = clamp(delaySeconds * (1 + stereoSpread), 0.02, 4);

  const feedbackBase = delayActive ? clamp(params.delayFeedback, 0, 0.9) : 0;
  const feedback = feedbackBase * delayConfig.localFeedback;
  const crossfeed = feedbackBase * delayConfig.crossFeedback;
  const delayLevel = delayActive ? Math.pow(params.delayMix, 0.88) : 0;
  const delaySend = delayLevel * 0.54;
  nodes.delaySend.gain.cancelScheduledValues(now);
  nodes.delaySend.gain.setTargetAtTime(delaySend, now, 0.05);

  const delayWetLevel = delayLevel * 0.68;
  nodes.delayWet.gain.cancelScheduledValues(now);
  nodes.delayWet.gain.setTargetAtTime(delayWetLevel, now, 0.05);

  const lowCut = clamp(
    params.delayLowCut + delayAge * delayConfig.ageLowCutLift,
    20,
    2600
  );
  const highCut = clamp(
    Math.max(
      params.delayHighCut * (1 - delayAge * delayConfig.ageHighCutDrop),
      lowCut + 400
    ),
    800,
    14000
  );

  const modulationDepth = delayActive
    ? delayConfig.modulationDepth
      * (0.35 + delayMotion * 1.9 + params.delayStereo * 0.35 + params.delayFeedback * 0.45)
    : 0;
  const modulationRate = delayConfig.modulationRate * (0.8 + delayMotion * 1.65);
  const flutterDepth = delayActive
    ? clamp(
      modulationDepth * delayConfig.flutterAmount * (0.18 + delayMotion * 0.9),
      0,
      0.0034
    )
    : 0;
  const flutterRate = delayConfig.flutterRate * (0.75 + delayMotion * 1.3);

  const delayDrive = delayActive
    ? clamp(delayConfig.drive + params.delayFeedback * 0.1 + delayAge * delayConfig.ageDrive, 0, 0.38)
    : 0;
  const duckRelease = clamp(
    delayConfig.duckRelease + (1 - delayMotion) * 0.06 + delayAge * 0.05,
    0.08,
    0.48
  );
  delayWorklet.setParams({
    enabled: delayActive,
    inputLeft: delayActive ? delayConfig.inputLeft : 0,
    inputRight: delayActive ? delayConfig.inputRight : 0,
    timeLeft: leftDelayTime,
    timeRight: rightDelayTime,
    feedback,
    crossfeed,
    lowCut,
    highCut,
    drive: delayDrive,
    modRate: modulationRate,
    modDepth: modulationDepth,
    flutterRate,
    flutterDepth,
    width: params.delayStereo,
    ducking: params.delayDucking,
    duckRelease
  });

  const reverbMode = REVERB_MODE_CONFIG[params.reverbMode]
    ? params.reverbMode
    : AUDIO_PARAM_DEFAULTS.reverbMode;
  const reverbConfig = REVERB_MODE_CONFIG[reverbMode];
  const reverbActive = params.reverbEnabled && params.reverbMix > 0.001;
  const reverbMix = reverbActive ? params.reverbMix : 0;
  const reverbLevel = reverbMix > 0 ? Math.pow(reverbMix, 1.06) : 0;
  nodes.reverbSend.gain.cancelScheduledValues(now);
  nodes.reverbSend.gain.setTargetAtTime(reverbLevel * reverbConfig.sendScale, now, 0.08);
  nodes.reverbWet.gain.cancelScheduledValues(now);
  nodes.reverbWet.gain.setTargetAtTime(reverbLevel * reverbConfig.wetScale, now, 0.12);

  const reverbTone = clamp(params.reverbTone + reverbConfig.toneOffset, 0, 1);
  const reverbDamping = clamp(
    0.18 + (1 - reverbTone) * 0.62 + reverbConfig.dampingOffset,
    0.12,
    0.9
  );
  const reverbLowCut = clamp(70 + (1 - reverbTone) * 180, 20, 1400);
  const reverbHighCut = clamp(
    Math.max(2600 + reverbTone * 9800, reverbLowCut + 900),
    1200,
    18000
  );

  reverbWorklet.setParams({
    enabled: reverbActive,
    variant: reverbMode,
    preDelay: params.reverbPreDelay / 1000,
    size: params.reverbSize,
    decay: params.reverbDecay,
    damping: reverbDamping,
    lowCut: reverbLowCut,
    highCut: reverbHighCut,
    width: clamp(params.reverbWidth + reverbConfig.widthBias, 0, 1),
    diffusion: clamp(reverbConfig.diffusion + params.reverbSize * 0.12, 0.4, 0.98),
    modRate: reverbConfig.modRate * (0.8 + params.reverbSize * 0.45),
    modDepth: reverbConfig.modDepth * (0.7 + params.reverbDecay * 0.6),
    earlyLevel: clamp(
      reverbConfig.earlyLevel * (0.7 + (1 - params.reverbSize) * 0.3),
      0.12,
      0.72
    )
  });

  const colorAmount = clamp(params.distortion, 0, 1);
  nodes.warmthFilter.gain.cancelScheduledValues(now);
  nodes.warmthFilter.gain.setTargetAtTime(colorAmount * 1.6, now, 0.12);
  nodes.presenceFilter.gain.cancelScheduledValues(now);
  nodes.presenceFilter.gain.setTargetAtTime(-reverbMix * 0.7, now, 0.12);
  nodes.postTone.gain.cancelScheduledValues(now);
  nodes.postTone.gain.setTargetAtTime(colorAmount * 0.4, now, 0.12);
  nodes.airFilter.gain.cancelScheduledValues(now);
  nodes.airFilter.gain.setTargetAtTime(-colorAmount * 0.8, now, 0.12);

  nodes.distortion.curve = distortionCache.get(params.distortion);

  const panValue = (params.pan - 0.5) * 2;
  nodes.stereoPanner.pan.cancelScheduledValues(now);
  nodes.stereoPanner.pan.setTargetAtTime(panValue, now, 0.05);

  synthWorklet.setParams(toWorkletParams(params));
}
