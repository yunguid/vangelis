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
    duration,
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
  return audioEngine.preloadNote({
    frequency,
    waveformType,
    duration,
    params: audioParams
  });
};
