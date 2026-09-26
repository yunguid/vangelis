import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from './audioEngineRuntime.js';
import { sanitizeAudioParams, toWorkletParams } from './audioParams.js';

/**
 * A score's parts: every layer is a synth worklet node of its own, so parts
 * with different patches sound together. The point is that no patch bleeds
 * across (a part never gets the player's sound, the main synth never gets a
 * part's), that a part's note reaches each of its layers, and that parts
 * never outlive their piece.
 */

let created = [];

class FakeWorkletNode {
  constructor(_ctx, _name, options) {
    this.options = options;
    this.messages = [];
    this.port = { postMessage: (message) => this.messages.push(message) };
    this.connect = vi.fn();
    this.disconnect = vi.fn();
    created.push(this);
  }
}

const fakeParam = () => ({ value: 1, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
const fakeGain = () => ({ gain: fakeParam(), connect: vi.fn(), disconnect: vi.fn() });

const lastMessages = () => created.map((node) => node.messages.at(-1));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('audioEngine parts', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of ['context', 'globalNodes', 'worklet', 'delayWorklet', 'reverbWorklet', 'lastParamSignature', 'currentParams', 'samplePool']) {
      saved[key] = audioEngine[key];
    }
    created = [];
    globalThis.AudioWorkletNode = FakeWorkletNode;
    audioEngine.context = {
      currentTime: 3,
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
      createGain: vi.fn(fakeGain)
    };
    audioEngine.globalNodes = {
      inputBus: fakeGain(),
      analyser: {},
      masterGain: fakeGain(),
      delaySend: fakeGain(),
      delayWet: fakeGain(),
      reverbSend: fakeGain(),
      reverbWet: fakeGain(),
      warmthFilter: fakeGain(),
      presenceFilter: fakeGain(),
      postTone: fakeGain(),
      airFilter: fakeGain(),
      distortion: { curve: null },
      stereoPanner: { pan: fakeParam() }
    };
    audioEngine.worklet = { setParams: vi.fn(), noteOn: vi.fn(), noteOff: vi.fn(), allNotesOff: vi.fn() };
    audioEngine.delayWorklet = { setParams: vi.fn() };
    audioEngine.reverbWorklet = { setParams: vi.fn() };
    audioEngine.lastParamSignature = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    audioEngine.parts.clear();
    audioEngine.clearActiveVoices();
    Object.assign(audioEngine, saved);
    delete globalThis.AudioWorkletNode;
  });

  it('gives each layer only its own patch and plays a part note on every layer', async () => {
    const lead = {
      layers: [
        { params: { attack: 0.3, useFilter: true, filterCutoff: 900, reverbMix: 0.9 }, waveformType: 'Sawtooth', gain: 0.5 },
        { params: { attack: 0.05, unisonVoices: 3 }, waveformType: 'Square' }
      ]
    };
    audioEngine.setPart('lead', lead);
    await flush();

    expect(created).toHaveLength(2);
    created.forEach((node, index) => {
      const own = toWorkletParams(sanitizeAudioParams(lead.layers[index].params));
      expect(node.options.processorOptions.paramDefaults).toEqual(own);
      expect(node.messages).toEqual([{ type: 'setParams', params: own }]);
      // Through the layer's own gain into the bus the main synth feeds.
      const gain = node.connect.mock.calls[0][0];
      expect(gain.connect).toHaveBeenCalledWith(audioEngine.globalNodes.inputBus);
      expect(gain.gain.value).toBe(index === 0 ? 0.5 : 1);
    });
    expect(audioEngine.worklet.setParams).not.toHaveBeenCalled();

    // The player's sound reaches the main synth and no part.
    audioEngine.setGlobalParams({ attack: 1.5, filterCutoff: 300 });
    expect(audioEngine.worklet.setParams).toHaveBeenCalledWith(expect.objectContaining({ attack: 1.5, filterCutoff: 300 }));
    created.forEach((node) => expect(node.messages).toHaveLength(1));

    const expr = { rate: 200, pitch: Float32Array.of(-80, 0) };
    const started = audioEngine.playPartNote({
      part: 'lead', noteId: 'n1', frequency: 392, velocity: 0.9, when: 4.25, expr, params: { reverbEnabled: true, reverbMix: 0.7 }
    });
    await flush();
    // The note brings the piece's room to the shared effects chain.
    expect(audioEngine.reverbWorklet.setParams).toHaveBeenCalled();
    expect(started.voiceId).toBe('n1');
    expect(lastMessages()).toEqual([
      { type: 'noteOn', noteId: 'n1', frequency: 392, waveform: 'Sawtooth', velocity: 0.9, when: 4.25, expr },
      { type: 'noteOn', noteId: 'n1', frequency: 392, waveform: 'Square', velocity: 0.9, when: 4.25, expr }
    ]);
    expect(audioEngine.worklet.noteOn).not.toHaveBeenCalled();
    expect(audioEngine.getActivity().activeVoices).toBe(1);

    audioEngine.stopNote('n1', 5.5);
    await flush();
    expect(lastMessages()).toEqual([
      { type: 'noteOff', noteId: 'n1', when: 5.5 },
      { type: 'noteOff', noteId: 'n1', when: 5.5 }
    ]);
    expect(audioEngine.getActivity().activeVoices).toBe(0);
    // The part's release never reaches the main synth.
    expect(audioEngine.worklet.noteOff).not.toHaveBeenCalled();

    // Setting the part again updates its layers in place.
    audioEngine.setPart('lead', { layers: [{ params: { attack: 0.7 }, waveformType: 'Sawtooth' }, lead.layers[1]] });
    expect(created).toHaveLength(2);
    expect(created[0].messages.at(-1)).toEqual({
      type: 'setParams', params: toWorkletParams(sanitizeAudioParams({ attack: 0.7 }))
    });
  });

  it('plays the keys on a layered sound’s layers from one sample, and keeps them past a score’s parts', async () => {
    audioEngine.samplePool = {};
    audioEngine.worklet = { ...audioEngine.worklet, ready: true, setPitchBend: vi.fn() };
    audioEngine.setKeyLayers([
      { waveformType: 'sine', gain: 0.42, audioParams: { attack: 0.08 } },
      { waveformType: 'sawtooth', gain: 0.77, audioParams: { phaseOffset: 180, useFilter: true } }
    ]);
    await flush();
    expect(created).toHaveLength(2);

    audioEngine.playFrequency({ noteId: 'k1', frequency: 440, velocity: 0.8, params: { reverbMix: 0.5 } });
    await flush();
    const [sine, saw] = lastMessages();
    expect(sine).toMatchObject({ type: 'noteOn', noteId: 'k1', waveform: 'sine', velocity: 0.8 });
    expect(saw).toMatchObject({ type: 'noteOn', noteId: 'k1', waveform: 'sawtooth', velocity: 0.8 });
    // The same start, ahead of now by more than the messages take to arrive.
    expect(sine.when).toBe(saw.when);
    expect(sine.when).toBeGreaterThan(audioEngine.context.currentTime);
    expect(audioEngine.worklet.noteOn).not.toHaveBeenCalled();

    audioEngine.setPitchBend(2);
    await flush();
    expect(lastMessages()).toEqual([{ type: 'pitchBend', value: 2 }, { type: 'pitchBend', value: 2 }]);

    // A piece's parts leave when it stops; the keys' layers and their sounding note stay.
    audioEngine.setPart('lead', { layers: [{ params: {} }] });
    audioEngine.clearParts();
    audioEngine.stopNote('k1');
    await flush();
    expect(created[0].messages.at(-1)).toEqual({ type: 'noteOff', noteId: 'k1', when: undefined });
    expect(created[1].messages.at(-1)).toEqual({ type: 'noteOff', noteId: 'k1', when: undefined });

    // Without layers the keys are the main synth's again.
    audioEngine.setKeyLayers(null);
    audioEngine.playFrequency({ noteId: 'k2', frequency: 220, params: {} });
    expect(audioEngine.worklet.noteOn).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'k2', frequency: 220 }));
  });

  it('stops every part with stopAllNotes, and clearParts retires them once released notes ring out', async () => {
    vi.useFakeTimers();
    audioEngine.setPart('pad', { layers: [{ params: { release: 2 } }, { params: { release: 2 } }] });
    await vi.advanceTimersByTimeAsync(0);

    audioEngine.stopAllNotes();
    await vi.advanceTimersByTimeAsync(0);
    expect(lastMessages()).toEqual([{ type: 'allNotesOff' }, { type: 'allNotesOff' }]);

    const gains = created.map((node) => node.connect.mock.calls[0][0]);
    audioEngine.clearParts();
    expect(audioEngine.playPartNote({ part: 'pad', noteId: 'late', frequency: 220 })).toBeNull();

    // A 2 s release rings for ~4.6 s (dsp/envelope.js) before the nodes go.
    await vi.advanceTimersByTimeAsync(4600);
    created.forEach((node) => expect(node.disconnect).not.toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(500);
    expect(lastMessages()).toEqual([{ type: 'dispose' }, { type: 'dispose' }]);
    created.forEach((node) => expect(node.disconnect).toHaveBeenCalled());
    gains.forEach((gain) => expect(gain.disconnect).toHaveBeenCalled());
  });
});
