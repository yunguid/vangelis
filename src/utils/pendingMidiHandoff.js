// Hands a parsed MIDI selection from a secondary page (Design, Studies) to the
// home player. Module-level because hash navigation never reloads the SPA.
let pendingMidi = null;

export const setPendingMidi = (midiData) => {
  pendingMidi = midiData;
};

export const consumePendingMidi = () => {
  const midi = pendingMidi;
  pendingMidi = null;
  return midi;
};
