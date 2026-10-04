/**
 * A piece turned into a piano lesson: its notes grouped into steps (what is struck together),
 * steps into phrases (a few bars, or the stretch between two breaths in free time), each
 * phrase with its key, its chords and how its notes sit on a grand staff.
 *
 * Pure functions over `{ midi, time, duration, velocity, hand, measure? }` notes, `hand` being
 * 'left' or 'right' and `measure` the bar position (1-based, fractional) when the piece has a
 * meter. The learn page (pages/LearnPage.jsx) draws and drills what this returns.
 */

/** Onsets closer than this are struck together (a slightly rolled chord is still one chord). */
export const CHORD_SPREAD = 0.07;

const PHRASE_MIN_STEPS = 6;
const PHRASE_TARGET_STEPS = 11;
const PHRASE_MAX_STEPS = 18;
const PHRASE_MAX_SECONDS = 16;

// ── Pitch spelling ─────────────────────────────────────────────────────

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
// Each letter's place on the line of fifths (F = -1, C = 0, G = 1, … B = 5).
const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5];
const ACCIDENTAL_SIGNS = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

const mod = (value, n) => ((value % n) + n) % n;

/**
 * A pitch class written in a key: the spelling nearest the key's centre on the line of fifths
 * (so D major writes F♯ and C♯, F major B♭, and a chromatic note leans the key's way).
 * `fifths` is the key signature: sharps positive, flats negative.
 */
export const spellPitchClass = (pc, fifths = 0) => {
  const centre = fifths + 2;
  let best = null;
  for (let letter = 0; letter < 7; letter += 1) {
    const accidental = mod(pc - LETTER_PC[letter] + 6, 12) - 6;
    if (Math.abs(accidental) > 1) continue;
    const position = LETTER_FIFTHS[letter] + 7 * accidental;
    const distance = Math.abs(position - centre);
    const better = !best
      || distance < best.distance
      || (distance === best.distance && (fifths >= 0 ? accidental > best.accidental : accidental < best.accidental));
    if (better) best = { letter, accidental, distance };
  }
  return { letter: best.letter, accidental: best.accidental };
};

/** A MIDI note written in a key: letter, accidental, octave, its staff step (C4 = 28) and name. */
export const spellMidi = (midi, fifths = 0) => {
  const { letter, accidental } = spellPitchClass(mod(midi, 12), fifths);
  // B♯ and C♭ cross the octave line; the octave follows the letter.
  const octave = Math.floor((midi - accidental) / 12) - 1;
  return {
    letter,
    accidental,
    octave,
    step: octave * 7 + letter,
    name: `${LETTERS[letter]}${ACCIDENTAL_SIGNS[accidental]}`,
    label: `${LETTERS[letter]}${ACCIDENTAL_SIGNS[accidental]}${octave}`
  };
};

/** The letters a key signature alters, in the order they are written (F C G D A E B / B E A D G C F). */
export const keySignatureLetters = (fifths) => {
  const sharps = [3, 0, 4, 1, 5, 2, 6];
  const flats = [6, 2, 5, 1, 4, 0, 3];
  return fifths >= 0 ? sharps.slice(0, fifths) : flats.slice(0, -fifths);
};

/** The accidental a key signature gives a letter: +1 sharp, -1 flat, 0 natural. */
export const keySignatureAccidental = (letter, fifths) => {
  if (!keySignatureLetters(fifths).includes(letter)) return 0;
  return fifths > 0 ? 1 : -1;
};

// ── Key ────────────────────────────────────────────────────────────────

// Krumhansl & Kessler's probe-tone profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const correlate = (weights, profile, tonic) => {
  const n = 12;
  const meanW = weights.reduce((a, b) => a + b, 0) / n;
  const meanP = profile.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dw = 0;
  let dp = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[mod(i + tonic, 12)] - meanW;
    const p = profile[i] - meanP;
    num += w * p;
    dw += w * w;
    dp += p * p;
  }
  return dw > 0 && dp > 0 ? num / Math.sqrt(dw * dp) : 0;
};

// Major keys' signatures by tonic pitch class, written the usual way (F♯ rather than G♭ is a tie
// broken towards sharps; D♭ rather than C♯).
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

/** The key a weighted pitch-class histogram sounds in. */
export const detectKey = (weights) => {
  let best = null;
  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const mode of ['major', 'minor']) {
      const score = correlate(weights, mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE, tonic);
      if (!best || score > best.score) best = { tonic, mode, score };
    }
  }
  const fifths = best.mode === 'major' ? MAJOR_FIFTHS[best.tonic] : MAJOR_FIFTHS[mod(best.tonic + 3, 12)];
  const tonicName = spellPitchClass(best.tonic, fifths);
  return {
    tonic: best.tonic,
    mode: best.mode,
    fifths,
    name: `${LETTERS[tonicName.letter]}${ACCIDENTAL_SIGNS[tonicName.accidental]} ${best.mode}`
  };
};

// ── Chords ─────────────────────────────────────────────────────────────

const CHORD_TYPES = [
  { suffix: '', quality: 'major', intervals: [0, 4, 7], weight: 1.0 },
  { suffix: 'm', quality: 'minor', intervals: [0, 3, 7], weight: 1.0 },
  { suffix: 'maj7', quality: 'major seventh', intervals: [0, 4, 7, 11], weight: 0.92 },
  { suffix: 'm7', quality: 'minor seventh', intervals: [0, 3, 7, 10], weight: 0.92 },
  { suffix: '7', quality: 'dominant seventh', intervals: [0, 4, 7, 10], weight: 0.9 },
  { suffix: 'add9', quality: 'major add nine', intervals: [0, 2, 4, 7], weight: 0.82 },
  { suffix: 'm(add9)', quality: 'minor add nine', intervals: [0, 2, 3, 7], weight: 0.82 },
  { suffix: 'sus2', quality: 'suspended second', intervals: [0, 2, 7], weight: 0.8 },
  { suffix: 'sus4', quality: 'suspended fourth', intervals: [0, 5, 7], weight: 0.8 },
  { suffix: '°', quality: 'diminished', intervals: [0, 3, 6], weight: 0.75 },
  { suffix: 'm7♭5', quality: 'half-diminished', intervals: [0, 3, 6, 10], weight: 0.75 },
  { suffix: '5', quality: 'open fifth', intervals: [0, 7], weight: 0.6 }
];

/**
 * The chord a weighted pitch-class histogram spells, given its bass. Each candidate scores the
 * weight its tones cover, less what it leaves out, with a nudge for a root in the bass; a
 * chord whose tones are missing (one sounding note) is not named.
 */
export const detectChord = (weights, bassPc = null, fifths = 0) => {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const peak = Math.max(...weights);
  const present = weights.map((w) => w >= peak * 0.18);
  if (present.filter(Boolean).length < 2) return null;
  let best = null;
  for (let root = 0; root < 12; root += 1) {
    if (!present[root]) continue;
    for (const type of CHORD_TYPES) {
      const tones = type.intervals.map((interval) => mod(root + interval, 12));
      if (!tones.every((pc) => present[pc])) continue;
      const covered = tones.reduce((sum, pc) => sum + weights[pc], 0) / total;
      const score = covered * type.weight + (root === bassPc ? 0.12 : 0) + tones.length * 0.015;
      if (!best || score > best.score) best = { root, type, tones, score };
    }
  }
  if (!best || best.score < 0.5) return null;
  const rootName = spellPitchClass(best.root, fifths);
  const name = `${LETTERS[rootName.letter]}${ACCIDENTAL_SIGNS[rootName.accidental]}`;
  let label = `${name}${best.type.suffix}`;
  if (bassPc !== null && bassPc !== best.root && best.tones.includes(bassPc)) {
    const bass = spellPitchClass(bassPc, fifths);
    label += `/${LETTERS[bass.letter]}${ACCIDENTAL_SIGNS[bass.accidental]}`;
  }
  return { root: best.root, quality: best.type.quality, suffix: best.type.suffix, label, tones: best.tones };
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10];

/** A chord's Roman numeral in a key (lower case for minor and diminished), or null off the scale. */
export const romanNumeral = (chord, key) => {
  if (!chord || !key) return null;
  const degrees = key.mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  const degree = degrees.indexOf(mod(chord.root - key.tonic, 12));
  if (degree < 0) return null;
  const minorish = /minor|diminished/.test(chord.quality);
  const numeral = minorish ? ROMAN[degree].toLowerCase() : ROMAN[degree];
  if (chord.suffix === '°') return `${numeral}°`;
  if (chord.suffix === 'm7♭5') return `${numeral}ø7`;
  return /seventh/.test(chord.quality) ? `${numeral}7` : numeral;
};

// ── Hands ──────────────────────────────────────────────────────────────

const HAND_WINDOW = 1.5; // seconds either side
const HAND_REACH = 14; // semitones below where the right hand is playing

/**
 * A split at middle C, refined: a right-hand note far below where the right hand is playing
 * around it (more than HAND_REACH under the median of its neighbours) goes to the left hand,
 * as a pianist would take it, unless it is above G4. Returns new notes.
 */
export const rebalanceHands = (notes) => {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  return sorted.map((note) => {
    if (note.hand !== 'right' || note.midi > 67) return note;
    const around = sorted
      .filter((other) => other !== note && other.hand === 'right' && Math.abs(other.time - note.time) <= HAND_WINDOW)
      .map((other) => other.midi)
      .sort((a, b) => a - b);
    if (around.length < 3) return note;
    const median = around[Math.floor(around.length / 2)];
    return median - note.midi > HAND_REACH ? { ...note, hand: 'left' } : note;
  });
};

// ── Steps and phrases ──────────────────────────────────────────────────

/** Notes struck together, in time order: `{ time, end, notes }` with each step's notes low to high. */
export const collectSteps = (notes) => {
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  const steps = [];
  for (const note of sorted) {
    const step = steps[steps.length - 1];
    if (step && note.time - step.time < CHORD_SPREAD) {
      if (!step.notes.some((other) => other.midi === note.midi)) step.notes.push(note);
      step.end = Math.max(step.end, note.time + note.duration);
    } else {
      steps.push({ time: note.time, end: note.time + note.duration, notes: [note] });
    }
  }
  steps.forEach((step) => step.notes.sort((a, b) => a.midi - b.midi));
  return steps;
};

/**
 * Phrases in free time: from each start, cut at the widest breath between PHRASE_MIN_STEPS and
 * PHRASE_MAX_STEPS steps on (a little in favour of cuts near PHRASE_TARGET_STEPS), never letting
 * one run past PHRASE_MAX_SECONDS.
 */
const cutAtBreaths = (steps) => {
  const cuts = [0];
  let start = 0;
  while (steps.length - start > PHRASE_MAX_STEPS) {
    let best = null;
    for (let j = start + PHRASE_MIN_STEPS; j <= Math.min(start + PHRASE_MAX_STEPS, steps.length - PHRASE_MIN_STEPS); j += 1) {
      if (steps[j].time - steps[start].time > PHRASE_MAX_SECONDS && best) break;
      const gap = steps[j].time - steps[j - 1].time;
      const score = gap * (1 - Math.abs(j - start - PHRASE_TARGET_STEPS) * 0.025);
      if (!best || score > best.score) best = { j, score };
    }
    if (!best) break;
    start = best.j;
    cuts.push(start);
  }
  return cuts;
};

/** Phrases in a metered piece: every `barsPerPhrase` bars, empty stretches skipped. */
const cutAtBars = (steps, barsPerPhrase) => {
  const cuts = [];
  let lastGroup = null;
  steps.forEach((step, index) => {
    const group = Math.floor((step.measure - 1) / barsPerPhrase);
    if (group !== lastGroup) {
      cuts.push(index);
      lastGroup = group;
    }
  });
  return cuts;
};

const histogram = (notes, from = -Infinity, to = Infinity) => {
  const weights = new Array(12).fill(0);
  for (const note of notes) {
    const start = Math.max(note.time, from);
    const end = Math.min(note.time + Math.max(note.duration, 0.15), to);
    if (end <= start) continue;
    weights[mod(note.midi, 12)] += (end - start) * (0.4 + (note.velocity ?? 0.7));
  }
  return weights;
};

const MIN_CHORD_SECONDS = 1.2;

/**
 * A phrase's chords over time windows: a bar each in a metered piece; in free time, from each
 * left-hand strike at least MIN_CHORD_SECONDS after the last window began. Each window is named
 * from everything sounding in it (harmony-only voices too) over its lowest left-hand note, and a
 * window naming the chord before joins it.
 */
const phraseChords = (steps, allNotes, end, key, metered) => {
  const anchors = [];
  steps.forEach((step, i) => {
    const previous = anchors[anchors.length - 1];
    if (metered) {
      if (!previous || Math.floor(step.measure) !== Math.floor(previous.measure)) anchors.push(step);
      return;
    }
    const hasLeft = step.notes.some((note) => note.hand === 'left');
    if (i === 0 || (hasLeft && step.time - previous.time >= MIN_CHORD_SECONDS)) anchors.push(step);
  });
  const chords = [];
  anchors.forEach((anchor, i) => {
    const from = anchor.time;
    const to = i + 1 < anchors.length ? anchors[i + 1].time : end;
    const sounding = allNotes.filter((note) => note.time < to - 1e-6 && note.time + note.duration > from + 0.05);
    const struck = steps.filter((step) => step.time >= from - 1e-6 && step.time < to - 1e-6).flatMap((step) => step.notes);
    if (struck.length === 0) return;
    const left = struck.filter((note) => note.hand === 'left');
    const bass = (left.length ? left : struck).reduce((low, note) => (note.midi < low.midi ? note : low));
    const chord = detectChord(histogram(sounding, from, to), mod(bass.midi, 12), key.fifths);
    if (!chord) return;
    const previous = chords[chords.length - 1];
    if (previous && previous.label === chord.label) {
      previous.duration = to - previous.time;
      return;
    }
    const firstLeft = anchor.notes.filter((note) => note.hand === 'left');
    chords.push({
      ...chord,
      time: from,
      duration: to - from,
      numeral: romanNumeral(chord, key),
      voicing: (firstLeft.length ? firstLeft : left.length ? [bass] : []).map((note) => note.midi)
    });
  });
  return chords;
};

const VOCABULARY_SIZE = 8;

/**
 * The chords worth learning first: grouped by chord (an inversion is the same chord), ranked by
 * how long they sound.
 */
const chordVocabulary = (phrases, home) => {
  const byName = new Map();
  phrases.forEach((phrase) => phrase.chords.forEach((chord) => {
    const name = chord.label.split('/')[0];
    let entry = byName.get(name);
    if (!entry) {
      // Numbered in the home key unless it first comes where the music has moved.
      const key = phrase.key.fifths === home.fifths ? home : phrase.key;
      entry = { label: name, root: chord.root, quality: chord.quality, suffix: chord.suffix, tones: chord.tones, key, seconds: 0, count: 0, voicings: new Map(), firstPhrase: phrase.index };
      byName.set(name, entry);
    }
    entry.seconds += chord.duration;
    entry.count += 1;
    if (chord.voicing.length) {
      const voicingKey = chord.voicing.join(',');
      entry.voicings.set(voicingKey, (entry.voicings.get(voicingKey) || 0) + chord.duration);
    }
  }));
  const all = [...byName.values()].sort((a, b) => b.seconds - a.seconds);
  // An open fifth on a root that also has a real chord is that chord with its third left out.
  const roots = new Set(all.filter((entry) => entry.suffix !== '5').map((entry) => entry.root));
  const chosen = all.filter((entry) => entry.suffix !== '5' || !roots.has(entry.root)).slice(0, VOCABULARY_SIZE);
  return chosen
    .sort((a, b) => a.firstPhrase - b.firstPhrase)
    .map(({ voicings, ...entry }) => {
      const best = [...voicings.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ...entry, numeral: romanNumeral(entry, entry.key), voicing: best ? best[0].split(',').map(Number) : [] };
    });
};

/**
 * The lesson: phrases (each with its steps, time span, key, chords and bar span when metered),
 * the piece's home key and the chords worth learning first. Notes whose hand is 'harmony' are
 * not played (a voice the reduction leaves out) but count towards naming the chords.
 */
export const buildLesson = (notes, { barsPerPhrase = null } = {}) => {
  const played = notes.filter((note) => note.hand !== 'harmony');
  const steps = collectSteps(played);
  if (steps.length === 0) return { phrases: [], key: null, vocabulary: [], stepCount: 0 };
  steps.forEach((step) => {
    step.measure = step.notes[0].measure ?? null;
  });
  const metered = Boolean(barsPerPhrase) && steps.every((step) => Number.isFinite(step.measure));
  const cuts = metered ? cutAtBars(steps, barsPerPhrase) : cutAtBreaths(steps);
  const home = detectKey(histogram(notes));
  const lastNoteEnd = Math.max(...played.map((note) => note.time + note.duration));

  const raw = cuts.map((from, i) => {
    const to = i + 1 < cuts.length ? cuts[i + 1] : steps.length;
    const phraseSteps = steps.slice(from, to);
    const start = phraseSteps[0].time;
    // A phrase ends where the next begins; the last where its notes have died away (within reason).
    const end = to < steps.length
      ? steps[to].time
      : Math.min(lastNoteEnd, phraseSteps[phraseSteps.length - 1].time + 6);
    return { steps: phraseSteps, start, end };
  });
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const notesBetween = (from, to) => sorted.filter((note) => note.time < to && note.time + note.duration > from);

  // Each phrase's key is read with its neighbours (one phrase is too few notes to be sure) and
  // stays the home key unless the music has clearly moved to another key signature: a turn to
  // the relative minor keeps the signature and is not a change to read differently.
  const fit = (local, key) => correlate(local, key.mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE, key.tonic);
  const heard = raw.map((phrase, i) => {
    const local = histogram(notesBetween(raw[Math.max(0, i - 1)].start, raw[Math.min(raw.length - 1, i + 1)].end));
    const key = detectKey(local);
    return key.fifths !== home.fifths && fit(local, key) - fit(local, home) > 0.25 ? key : home;
  });
  // A move that lasts a single phrase is not a modulation: it keeps the key around it. And
  // phrases in a row under one signature read in the first one's key.
  const keys = [];
  heard.forEach((key, i) => {
    const previous = keys[i - 1] || home;
    const lasting = heard[i - 1]?.fifths === key.fifths || heard[i + 1]?.fifths === key.fifths;
    keys.push(key.fifths === previous.fifths || !lasting ? previous : key);
  });

  const phrases = raw.map((phrase, i) => {
    const bars = metered
      ? [Math.floor(phrase.steps[0].measure), Math.floor(phrase.steps[phrase.steps.length - 1].measure)]
      : null;
    return {
      index: i,
      start: phrase.start,
      end: phrase.end,
      steps: phrase.steps,
      bars,
      key: keys[i],
      chords: phraseChords(phrase.steps, notesBetween(phrase.start, phrase.end), phrase.end, keys[i], metered)
    };
  });

  return { phrases, key: home, vocabulary: chordVocabulary(phrases, home), stepCount: steps.length };
};
