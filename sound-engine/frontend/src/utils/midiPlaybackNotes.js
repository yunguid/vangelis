export function normalizeMidiNotes(notes) {
  if (!Array.isArray(notes)) return [];

  const normalizedNotes = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  let isSorted = true;
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const midi = Number(note?.midi);
    const time = Number(note?.time);
    const duration = Number(note?.duration);
    const velocityRaw = Number(note?.velocity);

    if (!Number.isFinite(midi) || !Number.isFinite(time) || !Number.isFinite(duration)) {
      continue;
    }

    const normalizedMidi = Math.round(midi);
    if (!Number.isInteger(normalizedMidi) || normalizedMidi < 0 || normalizedMidi > 127) {
      continue;
    }

    const normalizedDuration = Math.max(0, duration);
    if (normalizedDuration <= 0) continue;

    const normalizedTime = Math.max(0, time);
    if (normalizedTime < previousTime) isSorted = false;
    previousTime = normalizedTime;
    normalizedNotes.push({
      ...note,
      midi: normalizedMidi,
      time: normalizedTime,
      duration: normalizedDuration,
      velocity: Number.isFinite(velocityRaw)
        ? Math.min(1, Math.max(0, velocityRaw))
        : 1,
      instrumentFamily: typeof note?.instrumentFamily === 'string'
        ? note.instrumentFamily.trim().toLowerCase()
        : note?.instrumentFamily,
      instrumentName: typeof note?.instrumentName === 'string'
        ? note.instrumentName.trim()
        : note?.instrumentName
    });
  }

  if (!isSorted) normalizedNotes.sort((a, b) => a.time - b.time);
  return normalizedNotes;
}
