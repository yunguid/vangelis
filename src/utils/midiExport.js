/**
 * A pattern as a Standard MIDI File: one MIDI track per layer, the pattern's
 * tempo, times written in ticks straight from beats so nothing drifts.
 * Deactivated notes stay out of the file, as they stay out of playback.
 *
 * Imported lazily: @tonejs/midi is only needed when a file is written.
 */
import { Midi } from '@tonejs/midi';

// General MIDI reserves channel 10 (index 9) for drums; layers skip it.
const channelForLayer = (index) => (index < 9 ? index : index + 1) % 16;

/** @returns {Uint8Array} */
export const patternToMidiBytes = (pattern) => {
  const midi = new Midi();
  midi.name = pattern.name || '';
  midi.header.setTempo(pattern.bpm);
  const ppq = midi.header.ppq;
  (pattern.tracks || []).forEach((track, index) => {
    const out = midi.addTrack();
    out.name = track.name || `Layer ${index + 1}`;
    out.channel = channelForLayer(index);
    pattern.notes
      .filter((note) => note.trackId === track.id && !note.muted)
      .forEach((note) => {
        out.addNote({
          midi: note.midi,
          ticks: Math.round(note.start * ppq),
          durationTicks: Math.max(1, Math.round(note.duration * ppq)),
          velocity: note.velocity
        });
      });
  });
  return midi.toArray();
};

/** A file name that survives every OS: the project name, or "untitled". */
export const midiFileName = (name) => {
  const base = String(name || '').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 64);
  return `${base || 'untitled'}.mid`;
};

/** Hand the pattern to the browser as a .mid download. */
export const downloadPatternMidi = (pattern) => {
  const blob = new Blob([patternToMidiBytes(pattern)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = midiFileName(pattern.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
