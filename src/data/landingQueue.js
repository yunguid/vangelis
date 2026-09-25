/**
 * The landing queue: the pieces the keyboard may play by itself when the page
 * opens. One is picked at random per visit from the ones switched on in the
 * MIDI tab; a built-in file is eligible when it carries a `landing` field
 * (see utils/midiParser.js).
 */
import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { withBase } from '../utils/baseUrl.js';

/**
 * Every piece that may open the page, and the performances the MIDI library
 * lists (utils/midiParser.js builds its rows from this list). Performances
 * bring a sampled instrument; originals name the Patch Lab sound they are
 * voiced with. `landing: false` keeps a performance in the library without
 * letting it open the page.
 */
export const LANDING_PIECES = Object.freeze([
  {
    id: 'performance-opening-piano',
    name: 'Subwoofer Lullaby',
    composer: 'C418',
    relativePath: 'subwoofer-lullaby.mid',
    instrument: 'opening-piano',
    instrumentLabel: 'Grand piano'
  },
  {
    id: 'performance-saudade-de-triana',
    name: 'Saudade de Triana',
    relativePath: 'performances/saudade-de-triana.mid',
    instrument: 'nylon-guitar',
    instrumentLabel: 'Nylon-string guitar',
    landing: false
  },
  {
    // Transcribed from Bonfá's 1959 record and played from recordings voiced
    // like it (data/pernambuco.js); the keys get the playable nylon guitar.
    id: 'performance-pernambuco',
    name: 'Pernambuco',
    composer: 'Luiz Bonfá',
    relativePath: 'performances/pernambuco.mid',
    instrument: 'nylon-guitar',
    transcription: 'pernambuco',
    instrumentLabel: 'Nylon-string guitar',
    // Its rendered waveform (scripts/render_performance.mjs --peaks), shown in the open sound dial.
    waveform: 'performances/pernambuco.waveform.json'
  }
]);

/** The landing pieces as built-in file entries (the shape the MIDI library lists). */
export const getLandingFiles = (base = import.meta.env.BASE_URL) => LANDING_PIECES.map(
  ({ relativePath, presetId, waveform, landing = true, ...piece }) => ({
    ...piece,
    path: withBase(`midi/${relativePath}`, base),
    ...(waveform ? { waveform: withBase(`midi/${waveform}`, base) } : {}),
    ...(landing ? { landing: presetId ? { presetId } : {} } : {})
  })
);

const SELECTION_KEY = 'vangelis.landingQueue.v1';
const LAST_PLAYED_KEY = 'vangelis.landingLast.v1';

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage: the queue just falls back to defaults.
  }
};

export const isLandingEligible = (file) => Boolean(file?.landing);

const REMOVED_KEY = 'vangelis.midiRemoved.v1';

/**
 * Built-in pieces the listener removed from the MIDI library. They stay out of
 * the list, its search and the landing queue until restored.
 */
export const loadRemovedPieces = () => {
  const stored = readJson(REMOVED_KEY);
  return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
};

export const saveRemovedPieces = (removed) => {
  writeJson(REMOVED_KEY, [...removed]);
};

/**
 * Ids switched on for landing. Nothing stored means every eligible piece; an
 * empty stored list is a real choice (the page opens silent).
 */
export const loadLandingSelection = (files) => {
  const eligibleIds = files.filter(isLandingEligible).map((file) => file.id);
  const stored = readJson(SELECTION_KEY);
  if (!Array.isArray(stored)) return new Set(eligibleIds);
  return new Set(stored.filter((id) => eligibleIds.includes(id)));
};

export const saveLandingSelection = (selection) => {
  writeJson(SELECTION_KEY, [...selection]);
};

/** Random pick that never repeats the previous visit while there is a choice. */
export const pickLandingPiece = (files, selection, lastId, random = Math.random) => {
  const enabled = files.filter((file) => isLandingEligible(file) && selection.has(file.id));
  if (enabled.length === 0) return null;
  const fresh = enabled.length > 1 ? enabled.filter((file) => file.id !== lastId) : enabled;
  return fresh[Math.min(Math.floor(random() * fresh.length), fresh.length - 1)];
};

export const loadLastLandingId = () => {
  const stored = readJson(LAST_PLAYED_KEY);
  return typeof stored === 'string' ? stored : null;
};

export const saveLastLandingId = (id) => writeJson(LAST_PLAYED_KEY, id);

/**
 * Turn a built-in file into a score ready for useMidiPlayback, voiced the way
 * the piece is meant to sound. Returns the score plus the player-level sound
 * (`params`, `waveformType`) it should be played through; `params` is null
 * when the piece only overrides part of the listener's own sound. `sound` is
 * that voice as the sound dial knows it (a sampled instrument or a preset), so
 * the page can load it for the keys too; null for a piece without one.
 */
export async function arrangeBuiltInPiece(context, file) {
  if (file.instrument) {
    // Loaded with the recordings, never with the page.
    const { findSampledInstrument } = await import('./sampledInstruments.js');
    const arranged = await arrangeSampledPiece(context, file);
    return { ...arranged, sound: findSampledInstrument(file.instrument) };
  }

  const { parseMidiFile } = await import('../utils/midiParser.js');
  const parsed = await parseMidiFile(file.path);
  const presetId = file.landing?.presetId;
  if (!presetId) return { score: parsed, params: null, waveformType: null, sound: null };
  const { PATCH_LAB_PRESETS } = await import('../utils/patchLabPresets.js');
  const preset = PATCH_LAB_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) throw new Error(`Landing piece ${file.id}: unknown preset ${presetId}`);
  const params = sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...preset.audioParams });
  // Each note carries the patch itself, so the very first one is already in
  // the right voice instead of waiting for the player to pick up new settings.
  const notes = parsed.notes.map((note) => ({
    ...note,
    waveformType: preset.waveformType,
    audioParams: params
  }));
  return { score: { ...parsed, notes }, params, waveformType: preset.waveformType, sound: preset };
}

/** A performance played from its own recordings. */
async function arrangeSampledPiece(context, file) {
  if (file.instrument === 'opening-piano') {
    const { loadOpeningPerformance, OPENING_PARAMS } = await import('./openingPerformance.js');
    const score = await loadOpeningPerformance(context);
    // The piano's envelope and room travel with the notes (as the guitar's do),
    // so it sounds right from the MIDI tab too; level and pan stay the listener's.
    const { volume, pan, ...room } = OPENING_PARAMS;
    const notes = score.notes.map((note) => ({ ...note, audioParamOverrides: room }));
    return { score: { ...score, notes }, params: OPENING_PARAMS, waveformType: 'Sine' };
  }

  if (file.transcription === 'pernambuco') {
    const { loadPernambuco } = await import('./pernambuco.js');
    return { score: await loadPernambuco(context, file.path), params: null, waveformType: 'Sine' };
  }

  if (file.instrument === 'nylon-guitar') {
    const [{ parseMidiFile }, { loadGuitarPerformance }] = await Promise.all([
      import('../utils/midiParser.js'),
      import('./nylonGuitar.js')
    ]);
    const parsed = await parseMidiFile(file.path);
    return { score: await loadGuitarPerformance(context, parsed), params: null, waveformType: 'Sine' };
  }

  throw new Error(`Landing piece ${file.id}: unknown instrument ${file.instrument}`);
}
