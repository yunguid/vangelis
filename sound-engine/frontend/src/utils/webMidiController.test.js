import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from './audioEngine.js';
import { startWebMidiInput } from './webMidiController.js';

vi.mock('./audioEngine.js', () => ({
  audioEngine: {
    playFrequency: vi.fn(),
    stopNote: vi.fn(),
    setPitchBend: vi.fn(),
    setModWheel: vi.fn()
  }
}));

describe('startWebMidiInput', () => {
  const originalRequestMidiAccess = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess');
  let input;
  let access;
  let callbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    input = { state: 'connected', name: 'Studio keys', onmidimessage: null };
    access = {
      inputs: new Map([['keys', input]]),
      onstatechange: null
    };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn().mockResolvedValue(access)
    });
    callbacks = {
      getWaveformType: vi.fn(() => 'triangle'),
      getAudioParams: vi.fn(() => ({ volume: 0.6 })),
      onDeviceName: vi.fn(),
      onNoteOn: vi.fn(),
      onNoteOff: vi.fn(),
      onAllNotesOff: vi.fn()
    };
  });

  afterEach(() => {
    if (originalRequestMidiAccess) {
      Object.defineProperty(navigator, 'requestMIDIAccess', originalRequestMidiAccess);
    } else {
      delete navigator.requestMIDIAccess;
    }
  });

  const start = async () => {
    const stop = startWebMidiInput(callbacks);
    await Promise.resolve();
    await Promise.resolve();
    return stop;
  };

  it('routes notes and continuous controllers without React work', async () => {
    const stop = await start();

    input.onmidimessage({ data: [0x90, 60, 127] });
    expect(audioEngine.playFrequency).toHaveBeenCalledWith(expect.objectContaining({
      noteId: 'webmidi-60',
      waveformType: 'triangle',
      velocity: 1
    }));
    expect(callbacks.onNoteOn).toHaveBeenCalledWith(60, 'C4');

    input.onmidimessage({ data: [0xe0, 0, 96] });
    expect(audioEngine.setPitchBend).toHaveBeenCalledWith(1);
    input.onmidimessage({ data: [0xb0, 1, 64] });
    expect(audioEngine.setModWheel).toHaveBeenCalledWith(64 / 127);

    input.onmidimessage({ data: [0x80, 60, 0] });
    expect(audioEngine.stopNote).toHaveBeenCalledWith('webmidi-60');
    expect(callbacks.onNoteOff).toHaveBeenCalledWith(60);
    stop();
  });

  it('attaches hot-plugged inputs and releases resources on cleanup', async () => {
    const stop = await start();
    const secondInput = { state: 'connected', name: 'Pads', type: 'input', onmidimessage: null };

    access.inputs.set('pads', secondInput);
    access.onstatechange({ port: secondInput });
    expect(secondInput.onmidimessage).toBeTypeOf('function');
    expect(callbacks.onDeviceName).toHaveBeenLastCalledWith('Studio keys, Pads');

    input.onmidimessage({ data: [0x90, 67, 90] });
    input.onmidimessage({ data: [0xb0, 123, 0] });
    expect(callbacks.onAllNotesOff).toHaveBeenCalledTimes(1);
    expect(audioEngine.stopNote).toHaveBeenCalledWith('webmidi-67');

    stop();
    expect(input.onmidimessage).toBeNull();
    expect(secondInput.onmidimessage).toBeNull();
    expect(access.onstatechange).toBeNull();
    expect(audioEngine.setPitchBend).toHaveBeenLastCalledWith(0);
    expect(audioEngine.setModWheel).toHaveBeenLastCalledWith(0);
  });
});
