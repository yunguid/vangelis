import { 
  wasm_generate_waveform, 
  wasm_generate_waveform_with_phase,
  wasm_fm_waveform,
  wasm_parallel_generate_waveform,
  wasm_apply_adsr,
  wasm_pan_stereo,
  WasmWaveform,
  ADSR
} from '../wasm/sound_engine.js';

// Audio context for the entire application
let audioContext = null;

// Create and initialize the audio context (must be called on user interaction)
export const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  // Main gain node for volume control
  const gainNode = audioCtx.createGain();
  
  // Reverb node (ConvolverNode)
  const reverbNode = audioCtx.createConvolver();
  
  // Create an impulse response for reverb
  const impulseLength = audioCtx.sampleRate * 3; // 3 seconds
  const impulse = audioCtx.createBuffer(2, impulseLength, audioCtx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const impulseData = impulse.getChannelData(channel);
    for (let i = 0; i < impulseLength; i++) {
      impulseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (impulseLength / 10));
    }
  }
  reverbNode.buffer = impulse;
  
  // Delay node
  const delayNode = audioCtx.createDelay(5.0); // max 5 seconds delay
  delayNode.delayTime.value = 0; // initial delay time
  
  // Feedback for delay
  const feedbackNode = audioCtx.createGain();
  feedbackNode.gain.value = 0; // Initial feedback amount
  
  // Distortion node
  const distortionNode = audioCtx.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(0); // Initial distortion amount
  distortionNode.oversample = '4x';
  
  // Analyzer node for visualizations
  const analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.8;
  
  // Connect the nodes
  // Source -> Distortion -> Delay -> Feedback -> Reverb -> Gain -> Analyzer -> Destination
  // Feedback path: Delay -> Feedback -> Delay
  
  distortionNode.connect(delayNode);
  delayNode.connect(feedbackNode);
  feedbackNode.connect(delayNode);
  delayNode.connect(reverbNode);
  reverbNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
  
  return {
    gainNode,
    reverbNode,
    delayNode,
    feedbackNode,
    distortionNode,
    analyserNode
  };
};

// Helper function to create distortion curve
function makeDistortionCurve(amount) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  
  return curve;
}

// Play a note with all the audio effects
export const playNote = (frequency, duration = 1.0, waveformType = 'Sine', audioParams = {}) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const nodes = createAudioNodes(ctx);
  
  // Set audio parameters from props
  nodes.gainNode.gain.value = audioParams.volume || 0.7;
  nodes.delayNode.delayTime.value = (audioParams.delay || 0) / 1000; // Convert to seconds
  nodes.feedbackNode.gain.value = Math.min((audioParams.delay || 0) / 1000, 0.9); // Feedback based on delay
  nodes.distortionNode.curve = makeDistortionCurve(audioParams.distortion * 100 || 0);
  
  const sampleRate = ctx.sampleRate;
  let samples;
  
  // Use different waveform generation methods based on audio parameters
  if (audioParams.useFM) {
    // Use FM synthesis if enabled
    const carrierFreq = frequency;
    const ratio = audioParams.fmRatio || 2.5;
    const modFreq = carrierFreq * ratio;
    const modIndex = audioParams.fmIndex || 5.0;
    samples = wasm_fm_waveform(carrierFreq, modFreq, modIndex, duration, sampleRate);
  } else if (audioParams.useParallel) {
    // Use parallel processing for better performance
    const wasmWaveform = getWasmWaveform(waveformType);
    samples = wasm_parallel_generate_waveform(wasmWaveform, frequency, duration, sampleRate);
  } else {
    // Use standard waveform with phase
    const wasmWaveform = getWasmWaveform(waveformType);
    const phaseOffset = audioParams.phaseOffset || 0;
    samples = wasm_generate_waveform_with_phase(wasmWaveform, frequency, phaseOffset, duration, sampleRate);
  }
  
  // Apply ADSR envelope if specified
  if (audioParams.useADSR) {
    const attack = audioParams.attack || 0.05;
    const decay = audioParams.decay || 0.1;
    const sustain = audioParams.sustain || 0.7;
    const release = audioParams.release || 0.3;
    
    wasm_apply_adsr(samples, attack, decay, sustain, release, sampleRate);
  }
  
  // Apply stereo panning if specified
  let bufferChannels = 1;
  let bufferData;
  
  if (audioParams.pan !== undefined && audioParams.pan !== 0.5) {
    // Convert pan from 0-1 range
    const stereoSamples = wasm_pan_stereo(samples, audioParams.pan);
    bufferChannels = 2;
    bufferData = stereoSamples;
  } else {
    bufferData = samples;
  }
  
  // Create buffer source
  const buffer = ctx.createBuffer(bufferChannels, samples.length, sampleRate);
  
  if (bufferChannels === 1) {
    buffer.copyToChannel(bufferData, 0);
  } else {
    // For stereo, every odd sample is left channel, every even is right channel
    const leftChannelData = new Float32Array(samples.length);
    const rightChannelData = new Float32Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      if (i % 2 === 0) {
        leftChannelData[i/2] = bufferData[i];
      } else {
        rightChannelData[(i-1)/2] = bufferData[i];
      }
    }
    
    buffer.copyToChannel(leftChannelData, 0);
    buffer.copyToChannel(rightChannelData, 1);
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  // Connect source to the first node in the chain
  source.connect(nodes.distortionNode);
  
  // Start playing
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