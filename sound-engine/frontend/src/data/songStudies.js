import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { withBase } from '../utils/baseUrl.js';

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

export const BUILT_IN_STUDIES = Object.freeze([
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
