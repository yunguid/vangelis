/**
 * Built-in instrument sample sets for selected MIDI pieces.
 * Loads audio buffers and maps MIDI instrument families to samples.
 */

import { audioEngine } from './audioEngine.js';
import { withBase } from './baseUrl.js';
import { getAllSoundSetManifests, getSoundSetManifest } from '../data/soundSets.js';
import { noteIdToMidi, pickBestInstrumentCandidate } from './instrumentSelection.js';
import { isUsableInstrumentDefinition } from './instrumentManifestGuards.js';

const toSamplePath = (relativePath, base = import.meta.env.BASE_URL) =>
  withBase(`samples/${relativePath}`, base);

const soundSetCache = new Map();
const rejectedInstrumentLog = new Set();

function toInstrumentLogKey(soundSetId, instrumentId, samplePath) {
  return `${soundSetId || 'unknown-set'}::${instrumentId || 'unknown-instrument'}::${samplePath || 'unknown-path'}`;
}

function materializeSoundSet(definition, base = import.meta.env.BASE_URL) {
  if (!definition) return null;

  const soundSetId = definition.id || 'unknown-set';
  const sanitizedInstruments = (definition.instruments || []).filter((instrument) => {
    if (isUsableInstrumentDefinition(instrument)) {
      return true;
    }

    const logKey = toInstrumentLogKey(soundSetId, instrument.id, instrument.samplePath);
    if (!rejectedInstrumentLog.has(logKey)) {
      rejectedInstrumentLog.add(logKey);
      console.warn(
        `Ignoring invalid instrument "${instrument.id || 'unknown'}" in sound set "${soundSetId}".`
      );
    }
    return false;
  });

  return {
    ...definition,
    instruments: sanitizedInstruments.map((instrument) => ({
      ...instrument,
      sampleUrl: instrument.sampleUrl || (instrument.samplePath ? toSamplePath(instrument.samplePath, base) : null)
    }))
  };
}

function noteIdToFrequency(noteId) {
  const midi = noteIdToMidi(noteId);
  if (!Number.isFinite(midi)) return null;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildInstrumentLookup(instruments) {
  const byFamily = new Map();
  const byName = new Map();

  instruments.forEach((instrument) => {
    (instrument.families || []).forEach((family) => {
      if (!byFamily.has(family)) {
        byFamily.set(family, []);
      }
      byFamily.get(family).push(instrument);
    });

    (instrument.names || []).forEach((name) => {
      byName.set(name, instrument);
    });
  });

  return { byFamily, byName };
}

function pickFromCandidates(candidates, note) {
  return pickBestInstrumentCandidate(candidates, note?.midi);
}

function pickInstrumentForNote(lookup, note = {}) {
  if (!lookup) return null;

  if (note.instrumentName && lookup.byName.has(note.instrumentName)) {
    return lookup.byName.get(note.instrumentName);
  }

  if (note.instrumentFamily && lookup.byFamily.has(note.instrumentFamily)) {
    return pickFromCandidates(lookup.byFamily.get(note.instrumentFamily), note);
  }

  return null;
}

function pickInstrumentsForNote(lookup, note = {}, layerFamilies = []) {
  if (!lookup) return [];

  const layered = [];
  layerFamilies.forEach((family) => {
    const candidates = lookup.byFamily.get(family);
    const picked = pickFromCandidates(candidates, note);
    if (picked) layered.push(picked);
  });

  if (layered.length > 0) {
    // Dedupe instruments while preserving family order.
    const deduped = [];
    const seen = new Set();
    layered.forEach((instrument) => {
      if (seen.has(instrument.id)) return;
      seen.add(instrument.id);
      deduped.push(instrument);
    });
    return deduped;
  }

  const fallback = pickInstrumentForNote(lookup, note);
  return fallback ? [fallback] : [];
}

async function loadInstrumentBuffer(ctx, instrument) {
  if (!instrument.sampleUrl) {
    throw new Error(`Missing sample URL for instrument "${instrument.id || instrument.label || 'unknown'}"`);
  }
  const response = await fetch(instrument.sampleUrl);
  if (!response.ok) {
    throw new Error(`Failed to load sample ${instrument.sampleUrl}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const baseMidi = Number.isFinite(instrument.baseMidi)
    ? instrument.baseMidi
    : noteIdToMidi(instrument.baseNote || 'C4');
  const baseFrequency = instrument.baseFrequency || noteIdToFrequency(instrument.baseNote || 'C4');

  return {
    ...instrument,
    buffer,
    baseFrequency,
    baseMidi
  };
}

/**
 * Get the sound set definition for display purposes.
 * @param {string} id
 */
export function getBuiltInSoundSet(id) {
  return materializeSoundSet(getSoundSetManifest(id));
}

/**
 * List all built-in sound set definitions (without decoded buffers).
 * @returns {Array}
 */
export function listBuiltInSoundSets() {
  return getAllSoundSetManifests().map((entry) => materializeSoundSet(entry)).filter(Boolean);
}

/**
 * Load and cache a built-in sound set.
 * @param {string} id
 * @returns {Promise<{id: string, name: string, instruments: Array, layerFamilies: Array<string>, pickInstrument: function, pickInstruments: function}|null>}
 */
export async function ensureSoundSetLoaded(id) {
  if (!id) return null;
  if (soundSetCache.has(id)) return soundSetCache.get(id);

  const soundSet = materializeSoundSet(getSoundSetManifest(id));
  if (!soundSet) return null;

  const ctx = await audioEngine.ensureAudioContext();
  const instrumentsWithUrls = (soundSet.instruments || []).filter((instrument) => Boolean(instrument.sampleUrl));
  if (instrumentsWithUrls.length === 0) {
    soundSetCache.set(id, null);
    return null;
  }

  const settledInstruments = await Promise.allSettled(
    instrumentsWithUrls.map((instrument) => loadInstrumentBuffer(ctx, instrument))
  );
  const loadedInstruments = settledInstruments
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  if (loadedInstruments.length === 0) {
    console.warn(`Sound set "${id}" could not load any samples; falling back to synth layers.`);
    soundSetCache.set(id, null);
    return null;
  }

  const lookup = buildInstrumentLookup(loadedInstruments);
  const layerFamilies = Array.isArray(soundSet.layerFamilies)
    ? soundSet.layerFamilies.filter(Boolean)
    : [];

  const loaded = {
    id: soundSet.id,
    name: soundSet.name,
    instruments: loadedInstruments,
    layerFamilies,
    pickInstrument: (note) => pickInstrumentForNote(lookup, note),
    pickInstruments: (note) => pickInstrumentsForNote(lookup, note, layerFamilies)
  };

  soundSetCache.set(id, loaded);
  return loaded;
}
