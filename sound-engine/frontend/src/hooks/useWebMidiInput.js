/**
 * Web MIDI input hook for Vangelis
 * Routes hardware MIDI keyboards into the synth engine:
 * - note on/off with velocity
 * - pitch bend wheel -> audioEngine.setPitchBend (+/-2 semitones)
 * - CC1 (mod wheel) -> audioEngine.setModWheel
 *
 * Degrades silently when the Web MIDI API is unavailable (e.g. Safari).
 * @module hooks/useWebMidiInput
 */

import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { midiNoteToFrequency, midiNoteToName } from '../utils/math.js';
import { useVisibleSnapshotPublisher } from './useVisibleSnapshotPublisher.js';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;
const CC_MOD_WHEEL = 1;
const BEND_RANGE_SEMITONES = 2;
const ACTIVE_NOTES_UPDATE_INTERVAL_MS = 40;

export function useWebMidiInput({ waveformType, audioParams, enabled = true }) {
  const [deviceName, setDeviceName] = useState(null);
  const [activeNotes, setActiveNotes] = useState(() => new Set());

  const waveformRef = useRef(waveformType);
  const audioParamsRef = useRef(audioParams);
  const heldRef = useRef(new Map()); // midi number -> display noteId
  const publishActiveNotes = useVisibleSnapshotPublisher({
    getSnapshot: () => new Set(heldRef.current.values()),
    publishSnapshot: setActiveNotes,
    intervalMs: ACTIVE_NOTES_UPDATE_INTERVAL_MS
  });

  useEffect(() => {
    waveformRef.current = waveformType;
  }, [waveformType]);

  useEffect(() => {
    audioParamsRef.current = audioParams;
  }, [audioParams]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return undefined;
    }

    let access = null;
    let cancelled = false;
    const attached = new Set();

    const noteOn = (midi, velocity) => {
      const frequency = midiNoteToFrequency(midi);
      if (!frequency) return;
      const { noteId } = midiNoteToName(midi);
      audioEngine.playFrequency({
        noteId: `webmidi-${midi}`,
        frequency,
        waveformType: waveformRef.current,
        params: audioParamsRef.current,
        velocity,
        allowVoicePhrase: true
      });
      heldRef.current.set(midi, noteId);
      publishActiveNotes();
    };

    const noteOff = (midi) => {
      audioEngine.stopNote(`webmidi-${midi}`);
      if (heldRef.current.delete(midi)) {
        publishActiveNotes();
      }
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
          } else if (d1 === 123) {
            // All notes off
            heldRef.current.forEach((_, midi) => audioEngine.stopNote(`webmidi-${midi}`));
            heldRef.current.clear();
            publishActiveNotes(true);
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
      setDeviceName(names.length > 0 ? names.join(', ') : null);
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
      heldRef.current.forEach((_, midi) => audioEngine.stopNote(`webmidi-${midi}`));
      heldRef.current.clear();
      audioEngine.setPitchBend(0);
      audioEngine.setModWheel(0);
    };
  }, [enabled, publishActiveNotes]);

  return { deviceName, activeNotes };
}
