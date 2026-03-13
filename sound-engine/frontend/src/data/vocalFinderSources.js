const encodeQuery = (value = '') => encodeURIComponent(value.trim());

export const VOCAL_TEXTURES = Object.freeze([
  { id: 'sultry', label: 'Sultry', query: 'sultry' },
  { id: 'airy', label: 'Airy', query: 'airy' },
  { id: 'breathy', label: 'Breathy', query: 'breathy' },
  { id: 'ethereal', label: 'Ethereal', query: 'ethereal' },
  { id: 'soulful', label: 'Soulful', query: 'soulful' },
  { id: 'cinematic', label: 'Cinematic', query: 'cinematic' }
]);

export const VOCAL_FORMATS = Object.freeze([
  { id: 'hooks', label: 'Hooks', query: 'hook' },
  { id: 'adlibs', label: 'Ad-libs', query: 'adlib' },
  { id: 'loops', label: 'Loops', query: 'loop' },
  { id: 'phrases', label: 'Phrases', query: 'phrase' },
  { id: 'choirs', label: 'Choirs', query: 'choir' },
  { id: 'spoken', label: 'Spoken', query: 'spoken word' }
]);

export const VOCAL_ACCESS_FILTERS = Object.freeze([
  { id: 'all', label: 'All access' },
  { id: 'free', label: 'Free only' },
  { id: 'paid', label: 'Paid only' }
]);

export const VOCAL_SEARCH_PRESETS = Object.freeze([
  {
    id: 'silva-bumpa',
    label: 'Silva Bumpa lane',
    toneId: 'sultry',
    formatId: 'hooks',
    extraTerms: 'ukg bassline rnb',
    bpm: 136
  },
  {
    id: 'sammy-virji',
    label: 'Sammy Virji lane',
    toneId: 'soulful',
    formatId: 'hooks',
    extraTerms: 'uk garage warm',
    bpm: 133
  },
  {
    id: 'oppidan',
    label: 'Oppidan lane',
    toneId: 'airy',
    formatId: 'phrases',
    extraTerms: 'swinging 2-step dreamy',
    bpm: 134
  },
  {
    id: 'bushbaby',
    label: 'Bushbaby lane',
    toneId: 'breathy',
    formatId: 'loops',
    extraTerms: 'shuffle bassline',
    bpm: 135
  }
]);

export const VOCAL_GUARDRAILS = Object.freeze([
  {
    id: 'no-scrape',
    title: 'No scraping',
    body: 'This page launches the providers own search flows. It does not mirror, crawl, or bulk-download their catalogs.'
  },
  {
    id: 'check-rights',
    title: 'Check rights',
    body: 'Every result still needs a human license check before use, especially on community-uploaded libraries.'
  },
  {
    id: 'search-like-a-producer',
    title: 'Search like a producer',
    body: 'Tone, phrasing, BPM, key, and texture work better than naming a specific singer you want to imitate.'
  }
]);

const getTexture = (textureId) => (
  VOCAL_TEXTURES.find((entry) => entry.id === textureId) || VOCAL_TEXTURES[0]
);

const getFormat = (formatId) => (
  VOCAL_FORMATS.find((entry) => entry.id === formatId) || VOCAL_FORMATS[0]
);

export const buildVocalSearchSpec = ({ textureId, formatId, extraTerms = '', bpm = '' }) => {
  const texture = getTexture(textureId);
  const format = getFormat(formatId);
  const trimmedExtras = extraTerms.trim();
  const normalizedBpm = Number.parseInt(`${bpm}`, 10);
  const resolvedBpm = Number.isFinite(normalizedBpm) && normalizedBpm > 0 ? normalizedBpm : null;
  const queryParts = ['female vocal', texture.query, format.query, trimmedExtras].filter(Boolean);
  const searchQuery = queryParts.join(' ');

  return {
    texture,
    format,
    extraTerms: trimmedExtras,
    bpm: resolvedBpm,
    searchQuery,
    displayQuery: queryParts.join(' / ')
  };
};

export const VOCAL_DISCOVERY_SOURCES = Object.freeze([
  {
    id: 'freesound',
    name: 'Freesound',
    access: 'free',
    rights: 'Check each result for CC0 vs attribution terms before you grab anything.',
    description: 'Strong for raw phrases, breaths, chops, strange one-shots, and useful weirdness.',
    ctaLabel: 'Search Freesound',
    getHref: (spec) => `https://freesound.org/search/?q=${encodeQuery(spec.searchQuery)}`,
    getHint: (spec) => spec.searchQuery
  },
  {
    id: 'pixabay',
    name: 'Pixabay',
    access: 'free',
    rights: 'Downloads sit under the Pixabay Content License on the item page.',
    description: 'Fast path for royalty-free vocal textures, voice FX, and quick previews.',
    ctaLabel: 'Search Pixabay',
    getHref: (spec) => `https://pixabay.com/sound-effects/search/${encodeQuery(spec.searchQuery)}/`,
    getHint: (spec) => spec.searchQuery
  },
  {
    id: 'splice',
    name: 'Splice',
    access: 'paid',
    rights: 'Royalty-free after download under your Splice plan and terms.',
    description: 'Best when you want polished hooks, toplines, stacks, or tightly tagged samples.',
    ctaLabel: 'Open female vocal catalog',
    getHref: () => 'https://splice.com/sounds/instruments/vocals-female/samples',
    getHint: (spec) => `${spec.texture.label} ${spec.format.label}`
  },
  {
    id: 'looperman',
    name: 'Looperman',
    access: 'free',
    rights: 'Usage is subject to Looperman rules and the uploader terms shown on the loop page.',
    description: 'Useful for free community loops when you want ideas quickly and can vet the rights yourself.',
    ctaLabel: 'Open female vocal loops',
    getHref: () => 'https://www.looperman.com/loops/tags/free-vocal-loop-female-loops-samples-sounds-wavs-download',
    getHint: (spec) => `${spec.texture.label} ${spec.format.label}`
  }
]);
