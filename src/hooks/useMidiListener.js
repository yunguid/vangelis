/**
 * Listen to a hardware MIDI keyboard without playing it: the learn page hears what the
 * learner plays on their own piano (which makes its own sound) and only checks the notes.
 * Listeners are added beside any other (addEventListener), so they never displace the
 * synth's own controller (utils/webMidiController.js).
 *
 * status: 'unsupported' (no Web MIDI: Safari, Firefox without the add-on), 'waiting' (asking),
 * 'denied', 'none' (allowed, nothing plugged in) or 'connected'.
 */
import { useEffect, useRef, useState } from 'react';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;
const CC_SUSTAIN = 64;

export function useMidiListener({ onNoteOn, onNoteOff, onSustain } = {}) {
  const supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  const [status, setStatus] = useState(supported ? 'waiting' : 'unsupported');
  const [deviceName, setDeviceName] = useState(null);
  const handlers = useRef({ onNoteOn, onNoteOff, onSustain });
  handlers.current = { onNoteOn, onNoteOff, onSustain };

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    let access = null;
    const attached = new Set();

    const onMessage = (event) => {
      const [status, d1, d2 = 0] = event.data || [];
      const command = status & 0xf0;
      if (command === NOTE_ON && d2 > 0) handlers.current.onNoteOn?.(d1, d2 / 127);
      else if (command === NOTE_OFF || (command === NOTE_ON && d2 === 0)) handlers.current.onNoteOff?.(d1);
      else if (command === CONTROL_CHANGE && d1 === CC_SUSTAIN) handlers.current.onSustain?.(d2 >= 64);
    };

    const refresh = () => {
      if (!access || cancelled) return;
      const names = [];
      access.inputs.forEach((input) => {
        if (input.state !== 'connected') return;
        names.push(input.name || 'MIDI keyboard');
        if (!attached.has(input)) {
          input.addEventListener('midimessage', onMessage);
          attached.add(input);
        }
      });
      setDeviceName(names.length ? names.join(', ') : null);
      setStatus(names.length ? 'connected' : 'none');
    };

    navigator.requestMIDIAccess({ sysex: false })
      .then((midiAccess) => {
        if (cancelled) return;
        access = midiAccess;
        access.addEventListener('statechange', refresh);
        refresh();
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });

    return () => {
      cancelled = true;
      attached.forEach((input) => input.removeEventListener('midimessage', onMessage));
      access?.removeEventListener('statechange', refresh);
    };
  }, [supported]);

  return { status, deviceName };
}
