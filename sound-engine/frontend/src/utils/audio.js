import { audioEngine } from './audioEngine.js';

export const initAudioContext = () => audioEngine.ensureAudioContext();

export const getAudioContext = () => audioEngine.context || null;

export const prewarmAudioGraph = () => audioEngine.warmGraph();

export const setGlobalAudioParams = (params) => {
  audioEngine.setGlobalParams(params);
};

export const playNote = (
  frequency,
  duration = 1.0,
  waveformType = 'Sine',
  audioParams = {},
  options = {}
) => {
  return audioEngine.playFrequency({
    noteId: options.noteId,
    frequency,
    waveformType,
    params: audioParams,
    velocity: options.velocity ?? 1
  });
};

export const stopNote = (noteId) => {
  audioEngine.stopNote(noteId);
};

export const getAnalyser = () => audioEngine.getAnalyser();

export const ensureWasmLoaded = () => audioEngine.ensureWasm();

export const audioEngineInstance = audioEngine;

export const preloadNote = ({ frequency, waveformType, audioParams = {}, duration }) => {
  // No preloading needed for oscillator-based synthesis
  return Promise.resolve();
};

// Custom sample functions
export const loadCustomSample = (file) => audioEngine.loadCustomSample(file);
export const clearCustomSample = () => audioEngine.clearCustomSample();
export const setCustomSampleBaseNote = (noteName, octave) => audioEngine.setCustomSampleBaseNote(noteName, octave);
export const setCustomSampleLoop = (loop) => audioEngine.setCustomSampleLoop(loop);

// Recording functions
export const startRecording = () => audioEngine.startRecording();
export const stopRecording = () => audioEngine.stopRecording();
export const toggleRecording = () => audioEngine.toggleRecording();
export const subscribeRecording = (listener) => audioEngine.subscribeRecording(listener);
