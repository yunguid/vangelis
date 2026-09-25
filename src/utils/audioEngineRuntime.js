/**
 * Vangelis Audio Engine Runtime
 * AudioWorklet-based polyphonic synth + Web Audio FX + sample playback
 */

import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_TRANSPORT_TEMPO,
  applyEffectToggleState,
  sanitizeAudioParams,
  toWorkletParams,
  WORKLET_PARAM_DEFAULTS
} from './audioParams.js';
import {
  DEFAULT_SAMPLE_RATE,
  SAMPLE_VOICE_POOL
} from './audioEngine/constants.js';
import { createAudioGraph } from './audioEngine/graph.js';
import { createSampleVoicePool } from './audioEngine/samplePool.js';
import { RecorderController } from './audioEngine/recorder.js';
import { applyGlobalParams, areAudioParamsEqual, DistortionCurveCache } from './audioEngine/effects.js';
import { buildFrequencyTable, getFrequencyFromTable } from './audioEngine/frequency.js';
import {
  DelayWorklet,
  DELAY_WORKLET_DEFAULTS,
  ReverbWorklet,
  REVERB_WORKLET_DEFAULTS,
  SynthWorklet
} from './audioEngine/worklets.js';
import { clamp } from './math.js';

class AudioEngine {
  constructor() {
    this.context = null;
    this.contextPromise = null;
    this.graphReady = false;

    this.statusListeners = new Set();
    this.status = {
      wasmReady: false,
      contextReady: false,
      graphWarmed: false,
      // The context exists but the browser will not run it without a gesture.
      audioBlocked: false,
      error: null
    };

    this.globalNodes = null;
    this.currentParams = applyEffectToggleState(sanitizeAudioParams(AUDIO_PARAM_DEFAULTS));
    this.lastParamSignature = '';
    this.transportTempoBpm = DEFAULT_TRANSPORT_TEMPO;

    this.worklet = new SynthWorklet(WORKLET_PARAM_DEFAULTS);
    // A score's named parts: synth voices with patches of their own, sounding
    // beside the main synth (name -> layers, see setPart), and which part each
    // of their sounding notes is on (voice id -> name), so stopNote finds it.
    this.parts = new Map();
    this.partVoices = new Map();
    this.delayWorklet = new DelayWorklet(DELAY_WORKLET_DEFAULTS);
    this.reverbWorklet = new ReverbWorklet(REVERB_WORKLET_DEFAULTS);

    this.recorder = new RecorderController({
      onStop: () => this.exportRecording()
    });

    this.samplePool = null;
    this.voiceSerial = 0;

    this.customSample = null;
    this.customSampleBaseFrequency = 261.63; // C4
    this.customSampleLoop = false;
    // A sampled instrument (data/sampledInstruments.js): notes play its recordings.
    this.instrument = null;

    this.isRecording = false;
    this.recordingListeners = new Set();
    this.activityListeners = new Set();
    this.activeVoiceIds = new Set();
    this.audioActivity = {
      isActive: false,
      activeVoices: 0,
      updatedAt: Date.now()
    };

    this.distortionCache = new DistortionCurveCache();
    this.frequencyTable = buildFrequencyTable();
  }

  // ============ Status Management ============

  subscribe(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  notify() {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }

  getStatus() {
    return {
      ...this.status,
      isRecording: this.isRecording,
      // Either way, notes are played from recordings and need no synth worklet.
      hasCustomSample: !!(this.customSample || this.instrument)
    };
  }

  subscribeRecording(listener) {
    this.recordingListeners.add(listener);
    return () => this.recordingListeners.delete(listener);
  }

  notifyRecording() {
    for (const listener of this.recordingListeners) {
      listener(this.isRecording);
    }
  }

  subscribeActivity(listener) {
    this.activityListeners.add(listener);
    listener(this.getActivity());
    return () => this.activityListeners.delete(listener);
  }

  notifyActivity() {
    const snapshot = this.getActivity();
    for (const listener of this.activityListeners) {
      listener(snapshot);
    }
  }

  getActivity() {
    return { ...this.audioActivity };
  }

  syncActivity() {
    const activeVoices = this.activeVoiceIds.size;
    const isActive = activeVoices > 0;
    if (
      this.audioActivity.activeVoices === activeVoices &&
      this.audioActivity.isActive === isActive
    ) {
      return;
    }

    this.audioActivity = {
      isActive,
      activeVoices,
      updatedAt: Date.now()
    };
    this.notifyActivity();
  }

  markVoiceStarted(voiceId) {
    if (!voiceId) return;
    this.activeVoiceIds.add(voiceId);
    this.syncActivity();
  }

  markVoiceStopped(voiceId) {
    if (!voiceId) return;
    this.activeVoiceIds.delete(voiceId);
    this.syncActivity();
  }

  clearActiveVoices() {
    if (this.activeVoiceIds.size === 0) return;
    this.activeVoiceIds.clear();
    this.syncActivity();
  }

  // ============ Audio Context Setup ============

  async ensureWasm() {
    return this.ensureWorklet();
  }

  async ensureWorklet() {
    try {
      const ctx = await this.ensureAudioContext();
      const nodes = this.setupGraph(ctx);
      await this.worklet.ensure(ctx, nodes.inputBus);

      if (!this.status.wasmReady) {
        this.status.wasmReady = true;
        this.notify();
      }

      return this.worklet;
    } catch (err) {
      this.reportStatusError('AUDIO_WORKLET_FAILED', 'Failed to initialize audio worklet', err);
      throw err;
    }
  }

  async ensureEffectWorklet({
    ctx,
    worklet,
    sourceNode,
    destinationNode,
    errorType,
    errorMessage
  }) {
    try {
      const nodes = this.setupGraph(ctx);
      await worklet.ensure(ctx, nodes[sourceNode], nodes[destinationNode]);
      return worklet;
    } catch (err) {
      this.reportStatusError(errorType, errorMessage, err);
      throw err;
    }
  }

  ensureDelayWorklet(ctx = this.context) {
    if (!ctx) return Promise.resolve(null);
    return this.ensureEffectWorklet({
      ctx,
      worklet: this.delayWorklet,
      sourceNode: 'delaySend',
      destinationNode: 'delayWet',
      errorType: 'DELAY_WORKLET_FAILED',
      errorMessage: 'Failed to initialize delay effect'
    });
  }

  ensureReverbWorklet(ctx = this.context) {
    if (!ctx) return Promise.resolve(null);
    return this.ensureEffectWorklet({
      ctx,
      worklet: this.reverbWorklet,
      sourceNode: 'reverbSend',
      destinationNode: 'reverbWet',
      errorType: 'REVERB_WORKLET_FAILED',
      errorMessage: 'Failed to initialize reverb effect'
    });
  }

  scheduleEnabledEffectWorklets(params, ctx = this.context) {
    if (!ctx || !params) return;
    if (params.delayEnabled && params.delayMix > 0.001) {
      this.ensureDelayWorklet(ctx).catch(() => {});
    }
    if (params.reverbEnabled && params.reverbMix > 0.001) {
      this.ensureReverbWorklet(ctx).catch(() => {});
    }
  }

  reportStatusError(type, message, err) {
    this.status.error = {
      type,
      message,
      detail: err.message,
      timestamp: Date.now()
    };
    this.notify();
  }

  async ensureRecorder(ctx) {
    const nodes = this.setupGraph(ctx);
    return this.recorder.ensure(ctx, nodes);
  }

  async ensureAudioContext() {
    if (this.contextPromise) {
      return this.contextPromise;
    }

    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const contextStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    let usedFallbackConstructor = false;
    this.contextPromise = Promise.resolve()
      .then(() => {
        let ctx;
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: DEFAULT_SAMPLE_RATE
          });
        } catch (err) {
          try {
            usedFallbackConstructor = true;
            ctx = new (window.AudioContext || window.webkitAudioContext)();
          } catch (fallbackErr) {
            throw new Error('Web Audio API not supported');
          }
        }

        this.context = ctx;
        this.status.contextReady = true;
        this.notify();

        this.installUnlockHandlers();
        this.setupGraph(ctx);
        this.scheduleEnabledEffectWorklets(this.currentParams, ctx);
        this.ensureSamplePool(ctx);

        if (ctx.state === 'running') {
          this.markGraphReady();
        }

        return ctx;
      })
      .then((ctx) => {
        if (contextStart !== null) {
          performanceProbe?.recordInteraction?.(
            'audio.context.ready',
            performance.now() - contextStart,
            {
              fallbackConstructor: usedFallbackConstructor,
              state: ctx.state,
              sampleRate: ctx.sampleRate
            }
          );
        }
        return ctx;
      })
      .catch((err) => {
        this.status.error = {
          type: 'AUDIO_CONTEXT_FAILED',
          message: 'Failed to initialize audio',
          detail: err.message,
          timestamp: Date.now()
        };
        this.notify();
        throw err;
      });

    return this.contextPromise;
  }

  installUnlockHandlers() {
    if (typeof window === 'undefined') return;

    // iOS plays Web Audio through the ringer channel, so the silent switch
    // mutes an instrument; a playback session sounds like any music app.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';

    // Browsers hold audio until a gesture that carries user activation. On
    // touch that is the release (pointerup/touchend/click), not the press, and
    // iOS interrupts a running context when the page is backgrounded, so every
    // gesture resumes a context that is not running.
    const resume = () => {
      if (this.context && this.context.state !== 'running') {
        this.context.resume().catch(() => {});
      }
    };
    ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click'].forEach((event) => {
      window.addEventListener(event, resume, { passive: true, capture: true });
    });

    const syncState = () => {
      const running = this.context.state === 'running';
      if (running) this.markGraphReady();
      if (this.status.audioBlocked === running) {
        this.status.audioBlocked = !running;
        this.notify();
      }
    };
    this.context.addEventListener('statechange', syncState);
    syncState();
  }

  markGraphReady() {
    if (this.graphReady) return;
    this.graphReady = true;
    this.status.graphWarmed = true;
    this.notify();
  }

  async warmGraph() {
    await this.ensureAudioContext();
    this.markGraphReady();
  }

  // ============ Audio Graph ============

  setupGraph(ctx) {
    if (this.globalNodes) {
      return this.globalNodes;
    }

    this.globalNodes = createAudioGraph(ctx, this.distortionCache);
    if (this.currentParams) {
      this.lastParamSignature = '';
      this.applyGlobalParams(this.currentParams);
    }
    return this.globalNodes;
  }

  // ============ Sample Voice Pool ============

  ensureSamplePool(ctx) {
    if (this.samplePool) return;

    const nodes = this.setupGraph(ctx);
    this.samplePool = createSampleVoicePool({
      ctx,
      inputBus: nodes.inputBus,
      poolSize: SAMPLE_VOICE_POOL
    });
  }

  // ============ Frequency Table ============

  getFrequency(noteName, octave) {
    return getFrequencyFromTable(this.frequencyTable, noteName, octave);
  }

  // ============ Parameter Management ============

  applyGlobalParams(sanitized) {
    const effective = applyEffectToggleState(sanitized);
    const paramsChanged = this.lastParamSignature === ''
      || !areAudioParamsEqual(this.currentParams, effective);
    this.currentParams = effective;

    const ctx = this.context;
    const nodes = this.globalNodes;
    if (!ctx || !nodes) {
      this.lastParamSignature = '';
      return;
    }

    this.scheduleEnabledEffectWorklets(effective, ctx);

    if (!paramsChanged) {
      return;
    }

    applyGlobalParams({
      params: effective,
      transportTempoBpm: this.transportTempoBpm,
      ctx,
      nodes,
      distortionCache: this.distortionCache,
      delayWorklet: this.delayWorklet,
      reverbWorklet: this.reverbWorklet,
      synthWorklet: this.worklet
    });
    this.lastParamSignature = 'applied';
  }

  setGlobalParams(params) {
    this.applyGlobalParams(sanitizeAudioParams(params));
  }

  setSanitizedGlobalParams(params) {
    this.applyGlobalParams(params);
  }

  setTransportTempo(bpm) {
    const nextTempo = clamp(
      Number.isFinite(bpm) ? bpm : DEFAULT_TRANSPORT_TEMPO,
      40,
      280
    );
    if (Math.abs(nextTempo - this.transportTempoBpm) < 0.01) return;
    this.transportTempoBpm = nextTempo;
    if (this.currentParams) {
      this.lastParamSignature = '';
      this.applyGlobalParams(this.currentParams);
    }
  }

  // ============ Note Playback ============

  playBufferedSample({
    noteId, buffer, frequency, baseFrequency, params = {}, velocity = 1, loop = false, when, brightness, mute, gain
  }) {
    if (!buffer) return null;
    if (!this.context) {
      this.ensureAudioContext().catch(() => {});
      return null;
    }

    this.ensureSamplePool(this.context);

    const sanitized = sanitizeAudioParams(params);
    this.applyGlobalParams(sanitized);

    const voiceId = noteId || `sample-${++this.voiceSerial}`;
    const voice = this.samplePool?.acquire(voiceId);
    if (!voice) return null;

    voice.startSample({
      noteId: voiceId,
      buffer,
      frequency,
      baseFrequency,
      velocity,
      params: sanitized,
      loop,
      when,
      brightness,
      mute,
      gain
    });
    this.markVoiceStarted(voiceId);

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  /**
   * `voiced` marks a note that brings its own sound (a piece's patch, an
   * editor layer): it is played by the synth even while an instrument is loaded.
   */
  playFrequency({ noteId, frequency, waveformType, params = {}, velocity = 1, voiced = false }) {
    if (!this.context) {
      this.ensureAudioContext().catch(() => {});
      return null;
    }

    this.ensureSamplePool(this.context);

    if (this.instrument && !voiced) {
      return this.playBufferedSample({
        noteId,
        frequency,
        params,
        ...this.instrument.pick(frequency, velocity, this.context.currentTime)
      });
    }

    if (!this.customSample && !this.worklet.ready) {
      this.ensureWorklet().catch(() => {});
      return null;
    }

    if (this.customSample) {
      return this.playBufferedSample({
        noteId,
        buffer: this.customSample,
        frequency,
        baseFrequency: this.customSampleBaseFrequency,
        velocity,
        params,
        loop: this.customSampleLoop
      });
    }

    const sanitized = sanitizeAudioParams(params);
    this.applyGlobalParams(sanitized);

    const voiceId = noteId || `voice-${++this.voiceSerial}`;

    this.worklet.noteOn({
      noteId: voiceId,
      frequency,
      waveform: waveformType || 'sine',
      velocity
    });
    this.markVoiceStarted(voiceId);

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  /** `when` (AudioContext seconds) releases a part's note on that exact sample. */
  stopNote(noteId, when) {
    if (!noteId) return;

    const part = this.partVoices.get(noteId);
    if (part !== undefined) {
      this.partVoices.delete(noteId);
      for (const layer of this.parts.get(part) || []) {
        layer.ready.then(() => layer.worklet.noteOff(noteId, when));
      }
      this.markVoiceStopped(noteId);
      return;
    }

    if (this.samplePool) {
      const releaseTime = this.currentParams?.release ?? AUDIO_PARAM_DEFAULTS.release;
      this.samplePool.release(noteId, releaseTime);
    }

    this.worklet.noteOff(noteId);
    this.markVoiceStopped(noteId);
  }

  setPitchBend(semitones) {
    this.worklet.setPitchBend(semitones);
  }

  setModWheel(value) {
    this.worklet.setModWheel(value);
  }

  stopAllNotes() {
    this.worklet.allNotesOff();
    for (const layers of this.parts.values()) {
      for (const layer of layers) layer.ready.then(() => layer.worklet.allNotesOff());
    }
    this.partVoices.clear();
    if (this.samplePool) {
      const releaseTime = this.currentParams?.release ?? AUDIO_PARAM_DEFAULTS.release;
      this.samplePool.releaseAll(releaseTime);
    }
    this.clearActiveVoices();
  }

  // ============ Parts ============

  /**
   * A named part of a score: layers ({ params, waveformType, gain = 1 }) that
   * each get a synth worklet node of their own, through their own gain into
   * the input bus, so parts with different patches sound together and share
   * the effects chain. The main synth's params never reach a part, nor a
   * part's the main synth. Setting a part again updates its layers in place.
   * Needs the audio context (the MIDI transport sets parts once it runs).
   */
  setPart(name, { layers = [] } = {}) {
    const ctx = this.context;
    const nodes = this.setupGraph(ctx);
    const part = this.parts.get(name) || [];
    this.parts.set(name, part);
    layers.forEach(({ params, waveformType, gain = 1 }, index) => {
      // The synth subset of a sanitized sound, exactly as the main synth gets it.
      const workletParams = toWorkletParams(sanitizeAudioParams(params));
      let layer = part[index];
      if (layer) {
        layer.worklet.setParams(workletParams);
        layer.gain.gain.cancelScheduledValues(ctx.currentTime);
        layer.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
      } else {
        const gainNode = ctx.createGain();
        gainNode.gain.value = gain;
        gainNode.connect(nodes.inputBus);
        const worklet = new SynthWorklet(workletParams);
        layer = {
          worklet,
          gain: gainNode,
          // Every message to a layer waits on its node, so none is lost while
          // the node is being created and all arrive in the order sent.
          ready: worklet.ensure(ctx, gainNode).catch((err) => {
            this.reportStatusError('PART_WORKLET_FAILED', `Failed to start part ${name}`, err);
          })
        };
        part[index] = layer;
      }
      layer.waveformType = waveformType || 'sine';
      layer.release = workletParams.release;
    });
    part.splice(layers.length).forEach((layer) => this.retirePartLayer(layer));
  }

  /** Every part of a score ({ name: { layers } }), as setPart sets one. */
  setParts(parts) {
    Object.entries(parts).forEach(([name, part]) => this.setPart(name, part));
  }

  /**
   * Play a note on every layer of a part, with the same id and expression on
   * each. `when` (AudioContext seconds) starts it on that exact sample;
   * `expr` is { rate, pitch, gain, cutoff, offset } (see SynthWorklet.noteOn).
   * `params` sets the effects chain, as a sampled note's do (a score's room
   * comes with each of its notes). stopNote releases it.
   */
  playPartNote({ part, noteId, frequency, velocity = 1, when, expr, params }) {
    const layers = this.parts.get(part);
    if (!layers) return null;
    if (params) this.applyGlobalParams(sanitizeAudioParams(params));

    const voiceId = noteId || `part-${++this.voiceSerial}`;
    for (const layer of layers) {
      const waveform = layer.waveformType;
      layer.ready.then(() => layer.worklet.noteOn({
        noteId: voiceId, frequency, waveform, velocity, when, expr
      }));
    }
    this.partVoices.set(voiceId, part);
    this.markVoiceStarted(voiceId);

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  /** Forget every part (a piece that used them has stopped). */
  clearParts() {
    for (const layers of this.parts.values()) {
      layers.forEach((layer) => this.retirePartLayer(layer));
    }
    this.parts.clear();
    this.partVoices.clear();
  }

  // A retired layer releases its notes and leaves the graph once they have
  // rung out: the envelope's release reaches silence at ~2.3x its time
  // (dsp/envelope.js), and cutting a tail short would click.
  retirePartLayer(layer) {
    layer.ready.then(() => {
      layer.worklet.allNotesOff();
      setTimeout(() => {
        layer.worklet.dispose();
        layer.gain.disconnect();
      }, (layer.release * 2.5 + 0.1) * 1000);
    });
  }

  getAnalyser() {
    return this.globalNodes?.analyser || null;
  }

  getAnalysisNodes() {
    if (!this.globalNodes) return null;
    return {
      analyser: this.globalNodes.analyser,
      leftAnalyser: this.globalNodes.leftAnalyser,
      rightAnalyser: this.globalNodes.rightAnalyser
    };
  }

  // ============ Sampled Instruments ============

  /** Play the keys through an instrument's recordings; null returns them to the synth. */
  setInstrument(instrument) {
    this.instrument = instrument || null;
    this.notify();
  }

  // ============ Custom Sample Support ============

  async loadCustomSample(file) {
    const ctx = await this.ensureAudioContext();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          this.customSample = audioBuffer;
          this.status.hasCustomSample = true;
          this.notify();

          resolve({
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
          });
        } catch (err) {
          reject(new Error('Failed to decode audio file: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  setCustomSampleBaseNote(noteName, octave) {
    const freq = this.getFrequency(noteName, octave);
    if (freq) {
      this.customSampleBaseFrequency = freq;
    }
  }

  setCustomSampleLoop(loop) {
    this.customSampleLoop = !!loop;
  }

  clearCustomSample() {
    if (this.samplePool) {
      this.samplePool.stopAll();
    }
    this.customSample = null;
    this.status.hasCustomSample = false;
    this.notify();
  }

  // ============ Recording ============

  async startRecording() {
    if (this.isRecording) return;

    await this.ensureAudioContext();
    if (!this.context) return;
    await this.ensureRecorder(this.context);

    this.recorder.start();
    this.isRecording = true;
    this.notifyRecording();
    this.notify();
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.recorder.stop();
    this.isRecording = false;
    this.notifyRecording();
    this.notify();
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  exportRecording() {
    if (!this.context) return;
    const wavBuffer = this.recorder.exportWav(this.context.sampleRate);
    if (!wavBuffer) return;

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `vangelis-recording-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
}

export const audioEngine = new AudioEngine();
