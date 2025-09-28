import {
  wasm_generate_waveform_with_phase,
  wasm_fm_waveform,
  wasm_apply_adsr,
  WasmWaveform
} from '../../public/pkg/sound_engine.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Audio context for the entire application
let audioContext = null;

// Reuse a single global node chain to avoid per-note construction overhead
let globalNodes = null;
let cachedReverbImpulse = null;

// Create and initialize the audio context (must be called on user interaction)
export const initAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive'
      });
    } catch (_) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

// Get the current audio context, or initialize if not available
export const getAudioContext = () => {
  if (!audioContext) {
    return initAudioContext();
  }
  return audioContext;
};

// Map waveform type string to WASM enum
export const getWasmWaveform = (waveformType) => {
  switch(waveformType) {
    case 'Sine': return WasmWaveform.Sine;
    case 'Square': return WasmWaveform.Square;
    case 'Sawtooth': return WasmWaveform.Sawtooth;
    case 'Triangle': return WasmWaveform.Triangle;
    default: return WasmWaveform.Sine;
  }
};

// Create all necessary audio nodes and connections
export const createAudioNodes = (audioCtx) => {
  // Deprecated: prefer ensureGlobalNodes(). Kept for backward-compat.
  return ensureGlobalNodes(audioCtx);
};

// Build or return the global audio node chain
function ensureGlobalNodes(audioCtx = getAudioContext()) {
  if (globalNodes) return globalNodes;

  const gainNode = audioCtx.createGain();
  const panNode = audioCtx.createStereoPanner();
  const reverbNode = audioCtx.createConvolver();
  const delayNode = audioCtx.createDelay(5.0);
  const feedbackNode = audioCtx.createGain();
  const distortionNode = audioCtx.createWaveShaper();
  const analyserNode = audioCtx.createAnalyser();

  // Cache or build reverb impulse once
  if (!cachedReverbImpulse) {
    const impulseLength = Math.floor(audioCtx.sampleRate * 1.5); // 1.5s IR for snappier init
    const impulse = audioCtx.createBuffer(2, impulseLength, audioCtx.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const impulseData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        impulseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (impulseLength / 8));
      }
    }
    cachedReverbImpulse = impulse;
  }
  reverbNode.buffer = cachedReverbImpulse;

  delayNode.delayTime.value = 0;
  feedbackNode.gain.value = 0;
  distortionNode.curve = makeDistortionCurve(0);
  distortionNode.oversample = '4x';
  analyserNode.fftSize = 1024;
  analyserNode.smoothingTimeConstant = 0.8;

  // Source -> Distortion -> Delay -> Feedback -> Reverb -> Gain -> Pan -> Analyser -> Destination
  distortionNode.connect(delayNode);
  delayNode.connect(feedbackNode);
  feedbackNode.connect(delayNode);
  delayNode.connect(reverbNode);
  reverbNode.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);

  globalNodes = {
    gainNode,
    panNode,
    reverbNode,
    delayNode,
    feedbackNode,
    distortionNode,
    analyserNode
  };
  return globalNodes;
}

function applyParamsToNodes(nodes, params) {
  const volume = clamp(params.volume ?? 0.7, 0, 1);
  nodes.gainNode.gain.value = volume;

  const delayMs = clamp(params.delay ?? 0, 0, 500);
  nodes.delayNode.delayTime.value = delayMs / 1000;
  nodes.feedbackNode.gain.value = clamp(delayMs / 1000, 0, 0.9);

  const distortionAmount = clamp(params.distortion ?? 0, 0, 1);
  nodes.distortionNode.curve = makeDistortionCurve(distortionAmount * 100);

  const pan = clamp(params.pan ?? 0.5, 0, 1);
  nodes.panNode.pan.value = (pan - 0.5) * 2;
}

// Helper function to create distortion curve
function makeDistortionCurve(amount) {
  const normalized = clamp(typeof amount === 'number' ? amount : 0, 0, 100);
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;

  if (normalized === 0) {
    for (let i = 0; i < n_samples; ++i) {
      curve[i] = (i * 2) / n_samples - 1;
    }
    return curve;
  }

  const k = normalized;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  
  return curve;
}

// Play a note with all the audio effects
export const playNote = (frequency, duration = 1.0, waveformType = 'Sine', audioParams = {}) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const params = audioParams || {};
  const nodes = ensureGlobalNodes(ctx);
  applyParamsToNodes(nodes, params);

  const sampleRate = ctx.sampleRate;
  const safeDuration = clamp(duration ?? 1.0, 0.05, 10);
  let samples;

  // Use different waveform generation methods based on audio parameters
  if (params.useFM) {
    const carrierFreq = Math.max(frequency, 0);
    const ratio = clamp(params.fmRatio ?? 2.5, 0.1, 10);
    const modFreq = carrierFreq * ratio;
    const modIndex = clamp(params.fmIndex ?? 5.0, 0, 100);
    samples = wasm_fm_waveform(carrierFreq, modFreq, modIndex, safeDuration, sampleRate);
  } else {
    const wasmWaveform = getWasmWaveform(waveformType);
    const phaseOffset = clamp(params.phaseOffset ?? 0, 0, Math.PI * 2);
    samples = wasm_generate_waveform_with_phase(wasmWaveform, frequency, phaseOffset, safeDuration, sampleRate);
  }

  // Apply ADSR envelope if specified
  if (params.useADSR) {
    const attack = clamp(params.attack ?? 0.05, 0, 5);
    const decay = clamp(params.decay ?? 0.1, 0, 5);
    const sustain = clamp(params.sustain ?? 0.7, 0, 1);
    const release = clamp(params.release ?? 0.3, 0, 5);
    wasm_apply_adsr(samples, attack, decay, sustain, release, sampleRate);
  }

  // Create buffer source (lightweight per note)
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(nodes.distortionNode);
  source.start();

  return {
    source,
    nodes,
    analyser: nodes.analyserNode
  };
};

// Get frequency data for visualizer
export const getFrequencyData = (analyserNode) => {
  if (!analyserNode) return new Uint8Array();
  
  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(dataArray);
  return dataArray;
}; 
