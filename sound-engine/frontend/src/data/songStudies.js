import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { withBase } from '../utils/baseUrl.js';
import classicalCatalog from './classicalCatalog.json';

export const DEFAULT_STUDY_WAVEFORM = 'triangle';
export const DEFAULT_STUDY_AUDIO_PARAMS = sanitizeAudioParams({
  ...AUDIO_PARAM_DEFAULTS,
  volume: 0.72,
  attack: 0.03,
  decay: 0.22,
  sustain: 0.78,
  release: 1.15,
  cutoff: 2800,
  resonance: 3.2,
  reverbEnabled: true,
  reverbMix: 0.28,
  delayEnabled: true,
  delayMix: 0.12,
  delayFeedback: 0.18
});

// Soft felt-piano voicing for classical catalog studies: fast-but-gentle
// attack, singing sustain, warm cutoff, hall tail, no delay repeats.
export const CLASSICAL_STUDY_AUDIO_PARAMS = sanitizeAudioParams({
  ...AUDIO_PARAM_DEFAULTS,
  volume: 0.74,
  attack: 0.012,
  decay: 0.3,
  sustain: 0.62,
  release: 0.85,
  cutoff: 4200,
  resonance: 1.4,
  reverbEnabled: true,
  reverbMode: 'hall',
  reverbMix: 0.22,
  delayEnabled: false
});

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatCatalogLabel = (catalog) => {
  if (!catalog) return '';
  const base = [catalog.op, catalog.d].filter(Boolean).join(' · ');
  return catalog.no ? `${base} No. ${catalog.no}` : base;
};

// Classical catalog entries become first-class studies, ordered by
// featuredRank so the flagship item is deterministically first.
const classicalStudies = [...classicalCatalog.entries]
  .sort((left, right) => (
    (left.featuredRank ?? Infinity) - (right.featuredRank ?? Infinity)
  ))
  .map((entry) => ({
    id: `classical:${entry.id}`,
    kind: 'builtin',
    slug: entry.id,
    title: entry.title,
    artist: entry.composer,
    eyebrow: [formatCatalogLabel(entry.catalog), entry.key, entry.yearComposed]
      .filter(Boolean)
      .join(' · '),
    sourceLabel: `${entry.provenance.source} · ${entry.provenance.license}`,
    midiUrl: withBase(entry.file),
    waveformType: DEFAULT_STUDY_WAVEFORM,
    audioParams: CLASSICAL_STUDY_AUDIO_PARAMS,
    featuredRank: entry.featuredRank ?? null,
    meta: {
      key: entry.key,
      catalogLabel: formatCatalogLabel(entry.catalog),
      composerYears: entry.composerYears,
      yearComposed: entry.yearComposed,
      duration: formatDuration(entry.durationSeconds),
      genre: entry.genre,
      period: entry.period
    },
    studyNotes: entry.studyNotes || '',
    provenance: entry.provenance
  }));

export const BUILT_IN_STUDIES = Object.freeze([
  ...classicalStudies,
  {
    id: 'builtin:to-the-unknown-man',
    kind: 'builtin',
    slug: 'to-the-unknown-man',
    title: 'To the Unknown Man',
    artist: 'Vangelis',
    eyebrow: 'Spiral / 1977',
    sourceLabel: 'Built-in study',
    midiUrl: withBase('midi/to-the-unknown-man.mid'),
    waveformType: DEFAULT_STUDY_WAVEFORM,
    audioParams: DEFAULT_STUDY_AUDIO_PARAMS
  }
]);

const BUILT_IN_STUDIES_BY_SLUG = new Map(
  BUILT_IN_STUDIES.map((study) => [study.slug, study])
);

const cleanText = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const findMergedMidiArtifact = (job) => (
  job?.artifacts?.find((artifact) => artifact.kind === 'merged-midi') || null
);

export const getBuiltInStudy = (slug) => BUILT_IN_STUDIES_BY_SLUG.get(slug) || null;

export const hasPlayableStudy = (job) => (
  job?.status === 'completed' && Boolean(findMergedMidiArtifact(job))
);

export const createGeneratedStudyFromJob = (job) => {
  if (!hasPlayableStudy(job)) {
    return null;
  }

  const mergedMidi = findMergedMidiArtifact(job);
  const artist = cleanText(job.artist) || 'Pipeline capture';
  const title = cleanText(job.song) || 'Untitled study';
  const tempoBpm = Number.isFinite(job.tempo_bpm) ? Math.round(job.tempo_bpm) : null;

  return {
    id: job.id,
    kind: 'generated',
    jobId: job.id,
    title,
    artist,
    eyebrow: tempoBpm ? `${artist} / ${tempoBpm} BPM` : `${artist} / pipeline study`,
    sourceLabel: job.source_url ? 'YouTube import' : 'Search import',
    sourceUrl: cleanText(job.source_url),
    midiUrl: mergedMidi.url,
    waveformType: DEFAULT_STUDY_WAVEFORM,
    audioParams: DEFAULT_STUDY_AUDIO_PARAMS,
    updatedAt: job.updated_at || 0
  };
};
