/**
 * Lightweight audio-engine gateway.
 *
 * The Web Audio graph, worklet clients, recorder, and sample pool are loaded
 * only when warmup or an audio interaction asks for them. Synchronous callers
 * continue to see the same singleton surface once that runtime is ready.
 */

const COLD_STATUS = Object.freeze({
  wasmReady: false,
  contextReady: false,
  graphWarmed: false,
  error: null,
  isRecording: false,
  hasCustomSample: false,
  hasVoicePhrase: false
});

const COLD_ACTIVITY = Object.freeze({
  isActive: false,
  activeVoices: 0,
  updatedAt: 0
});

const COLD_VOICE_PHRASE = Object.freeze({
  enabled: false,
  chunkCount: 0,
  nextIndex: 0,
  lastChunk: null,
  sourceText: ''
});

const defaultRuntimeLoader = () => import('./audioEngineRuntime.js')
  .then(({ audioEngine: runtime }) => runtime);

export class LazyAudioEngineGateway {
  constructor({ loadRuntime = defaultRuntimeLoader } = {}) {
    this.loadRuntime = loadRuntime;
    this.runtime = null;
    this.runtimePromise = null;
    this.pendingParams = null;
    this.pendingTempo = null;
    this.statusListeners = new Set();
    this.recordingListeners = new Set();
    this.activityListeners = new Set();
    this.voicePhraseListeners = new Set();
    this.runtimeUnsubscribers = [];
  }

  get context() {
    return this.runtime?.context || null;
  }

  isLoaded() {
    return this.runtime !== null;
  }

  async ensureRuntime() {
    if (this.runtime) return this.runtime;
    if (!this.runtimePromise) {
      this.runtimePromise = Promise.resolve()
        .then(() => this.loadRuntime())
        .then((runtime) => {
          this.runtime = runtime;
          this.attachRuntime(runtime);
          if (this.pendingParams) runtime.setGlobalParams(this.pendingParams);
          if (this.pendingTempo !== null) runtime.setTransportTempo(this.pendingTempo);
          this.emitStatus(runtime.getStatus());
          return runtime;
        })
        .catch((error) => {
          this.runtimePromise = null;
          throw error;
        });
    }
    return this.runtimePromise;
  }

  attachRuntime(runtime) {
    this.runtimeUnsubscribers.push(
      runtime.subscribe((status) => this.emitStatus(status)),
      runtime.subscribeRecording((isRecording) => this.emitRecording(isRecording)),
      runtime.subscribeActivity((activity) => this.emitActivity(activity)),
      runtime.subscribeVoicePhrase((voicePhrase) => this.emitVoicePhrase(voicePhrase))
    );
  }

  emitStatus(status) {
    this.statusListeners.forEach((listener) => listener(status));
  }

  emitRecording(isRecording) {
    this.recordingListeners.forEach((listener) => listener(isRecording));
  }

  emitActivity(activity) {
    this.activityListeners.forEach((listener) => listener(activity));
  }

  emitVoicePhrase(voicePhrase) {
    this.voicePhraseListeners.forEach((listener) => listener(voicePhrase));
  }

  getStatus() {
    return this.runtime?.getStatus() || { ...COLD_STATUS };
  }

  subscribe(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribeRecording(listener) {
    this.recordingListeners.add(listener);
    return () => this.recordingListeners.delete(listener);
  }

  getActivity() {
    return this.runtime?.getActivity() || { ...COLD_ACTIVITY };
  }

  subscribeActivity(listener) {
    this.activityListeners.add(listener);
    listener(this.getActivity());
    return () => this.activityListeners.delete(listener);
  }

  getVoicePhraseStatus() {
    return this.runtime?.getVoicePhraseStatus() || { ...COLD_VOICE_PHRASE };
  }

  subscribeVoicePhrase(listener) {
    this.voicePhraseListeners.add(listener);
    listener(this.getVoicePhraseStatus());
    return () => this.voicePhraseListeners.delete(listener);
  }

  setGlobalParams(params) {
    this.pendingParams = params;
    this.runtime?.setGlobalParams(params);
  }

  setTransportTempo(bpm) {
    this.pendingTempo = bpm;
    this.runtime?.setTransportTempo(bpm);
  }

  ensureWasm() {
    return this.ensureRuntime().then((runtime) => runtime.ensureWasm());
  }

  ensureWorklet() {
    return this.ensureRuntime().then((runtime) => runtime.ensureWorklet());
  }

  ensureAudioContext() {
    return this.ensureRuntime().then((runtime) => runtime.ensureAudioContext());
  }

  warmGraph() {
    return this.ensureRuntime().then((runtime) => runtime.warmGraph());
  }

  playFrequency(options) {
    return this.runtime?.playFrequency(options) || null;
  }

  playBufferedSample(options) {
    return this.runtime?.playBufferedSample(options) || null;
  }

  stopNote(noteId) {
    this.runtime?.stopNote(noteId);
  }

  stopAllNotes() {
    this.runtime?.stopAllNotes();
  }

  setPitchBend(semitones) {
    this.runtime?.setPitchBend(semitones);
  }

  setModWheel(value) {
    this.runtime?.setModWheel(value);
  }

  getAnalyser() {
    return this.runtime?.getAnalyser() || null;
  }

  getAnalysisNodes() {
    return this.runtime?.getAnalysisNodes() || null;
  }

  loadCustomSample(file) {
    return this.ensureRuntime().then((runtime) => runtime.loadCustomSample(file));
  }

  clearCustomSample() {
    this.runtime?.clearCustomSample();
  }

  setCustomSampleBaseNote(noteName, octave) {
    this.runtime?.setCustomSampleBaseNote(noteName, octave);
  }

  setCustomSampleLoop(loop) {
    this.runtime?.setCustomSampleLoop(loop);
  }

  setVoicePhrase(options) {
    return this.ensureRuntime().then((runtime) => runtime.setVoicePhrase(options));
  }

  setVoicePhraseEnabled(enabled) {
    this.runtime?.setVoicePhraseEnabled(enabled);
  }

  clearVoicePhrase() {
    this.runtime?.clearVoicePhrase();
  }

  startRecording() {
    return this.ensureRuntime().then((runtime) => runtime.startRecording());
  }

  stopRecording() {
    this.runtime?.stopRecording();
  }

  toggleRecording() {
    if (this.runtime) return this.runtime.toggleRecording();
    return this.ensureRuntime().then((runtime) => runtime.toggleRecording());
  }
}

export const audioEngine = new LazyAudioEngineGateway();
