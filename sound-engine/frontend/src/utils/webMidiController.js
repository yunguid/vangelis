/**
 * Hardware Web MIDI controller bridge.
 *
 * Kept outside the React startup graph so browsers without Web MIDI never
 * download this code, and supported browsers can initialize it after the
 * first application commit.
 */

import { audioEngine } from './audioEngine.js';
import { midiNoteToFrequency, midiNoteToName } from './math.js';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;
const CC_MOD_WHEEL = 1;
const CC_ALL_NOTES_OFF = 123;
const BEND_RANGE_SEMITONES = 2;

export function startWebMidiInput({
  getWaveformType,
  getAudioParams,
  onDeviceName,
  onNoteOn,
  onNoteOff,
  onAllNotesOff
}) {
  let access = null;
  let cancelled = false;
  const attached = new Set();
  const heldMidi = new Set();
  const pendingNoteTokens = new Map();

  const playNote = (midi, frequency, velocity) => {
    audioEngine.playFrequency({
      noteId: `webmidi-${midi}`,
      frequency,
      waveformType: getWaveformType(),
      params: getAudioParams(),
      velocity,
      allowVoicePhrase: true
    });
  };

  const noteOn = (midi, velocity) => {
    const frequency = midiNoteToFrequency(midi);
    if (!frequency) return;
    const { noteId } = midiNoteToName(midi);
    heldMidi.add(midi);
    onNoteOn(midi, noteId);

    const status = audioEngine.getStatus();
    if (audioEngine.context && status.wasmReady) {
      playNote(midi, frequency, velocity);
      return;
    }

    const token = {};
    pendingNoteTokens.set(midi, token);
    Promise.resolve(audioEngine.ensureWasm()).then(() => {
      if (cancelled || !heldMidi.has(midi) || pendingNoteTokens.get(midi) !== token) return;
      pendingNoteTokens.delete(midi);
      playNote(midi, frequency, velocity);
    }).catch(() => {
      if (pendingNoteTokens.get(midi) === token) pendingNoteTokens.delete(midi);
    });
  };

  const noteOff = (midi) => {
    pendingNoteTokens.delete(midi);
    audioEngine.stopNote(`webmidi-${midi}`);
    heldMidi.delete(midi);
    onNoteOff(midi);
  };

  const stopAllNotes = () => {
    pendingNoteTokens.clear();
    heldMidi.forEach((midi) => audioEngine.stopNote(`webmidi-${midi}`));
    heldMidi.clear();
    onAllNotesOff();
  };

  const handleMessage = (event) => {
    const data = event.data;
    if (!data || data.length < 2) return;
    const command = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data.length > 2 ? data[2] : 0;

    switch (command) {
      case NOTE_ON:
        if (d2 > 0) noteOn(d1, d2 / 127);
        else noteOff(d1);
        break;
      case NOTE_OFF:
        noteOff(d1);
        break;
      case PITCH_BEND: {
        const value14 = (d2 << 7) | d1;
        const semitones = ((value14 - 8192) / 8192) * BEND_RANGE_SEMITONES;
        audioEngine.setPitchBend(semitones);
        break;
      }
      case CONTROL_CHANGE:
        if (d1 === CC_MOD_WHEEL) {
          audioEngine.setModWheel(d2 / 127);
        } else if (d1 === CC_ALL_NOTES_OFF) {
          stopAllNotes();
        }
        break;
      default:
        break;
    }
  };

  const updateDeviceName = () => {
    if (!access) return;
    const names = [];
    access.inputs.forEach((input) => {
      if (input.state === 'connected') names.push(input.name || 'MIDI device');
    });
    onDeviceName(names.length > 0 ? names.join(', ') : null);
  };

  const attach = (input) => {
    if (attached.has(input)) return;
    input.onmidimessage = handleMessage;
    attached.add(input);
  };

  navigator.requestMIDIAccess({ sysex: false })
    .then((midiAccess) => {
      if (cancelled) return;
      access = midiAccess;
      access.inputs.forEach(attach);
      updateDeviceName();
      access.onstatechange = (event) => {
        if (cancelled) return;
        if (event.port?.type === 'input' && event.port.state === 'connected') {
          attach(event.port);
        }
        updateDeviceName();
      };
    })
    .catch(() => {
      // Permission denied or no MIDI subsystem; stay silent.
    });

  return () => {
    cancelled = true;
    attached.forEach((input) => {
      input.onmidimessage = null;
    });
    if (access) access.onstatechange = null;
    heldMidi.forEach((midi) => audioEngine.stopNote(`webmidi-${midi}`));
    heldMidi.clear();
    pendingNoteTokens.clear();
    audioEngine.setPitchBend(0);
    audioEngine.setModWheel(0);
  };
}
