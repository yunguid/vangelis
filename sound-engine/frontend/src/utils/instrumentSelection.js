const NOTE_BASE_OFFSETS = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11
};

export const noteIdToMidi = (noteId) => {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteId || '');
  if (!match) return null;

  const [, noteName, octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  const noteOffset = NOTE_BASE_OFFSETS[noteName];

  if (!Number.isFinite(octave) || noteOffset == null) {
    return null;
  }

  return (octave + 1) * 12 + noteOffset;
};

export const instrumentMatchesMidiRange = (instrument, midiNote) => {
  if (!Number.isFinite(midiNote)) return true;
  const aboveMin = instrument.minMidi == null || midiNote >= instrument.minMidi;
  const belowMax = instrument.maxMidi == null || midiNote <= instrument.maxMidi;
  return aboveMin && belowMax;
};

const getInstrumentBaseMidi = (instrument) => {
  if (Number.isFinite(instrument.baseMidi)) {
    return instrument.baseMidi;
  }
  if (typeof instrument.baseNote === 'string') {
    return noteIdToMidi(instrument.baseNote);
  }
  return null;
};

export const pickBestInstrumentCandidate = (candidates, midiNote) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  if (!Number.isFinite(midiNote)) {
    return candidates[0];
  }

  const ranged = candidates.filter((instrument) => instrumentMatchesMidiRange(instrument, midiNote));
  const pool = ranged.length > 0 ? ranged : candidates;

  let best = pool[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    const baseMidi = getInstrumentBaseMidi(candidate);
    if (!Number.isFinite(baseMidi)) {
      continue;
    }

    const distance = Math.abs(baseMidi - midiNote);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};
