const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const FREESOUND_SEARCH_URL = 'https://freesound.org/apiv2/search/';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';
const MAX_QUERY_VARIANTS = 4;
const MAX_RESULTS = 12;
const FREESOUND_FIELDS = [
  'id',
  'name',
  'username',
  'license',
  'url',
  'previews',
  'duration',
  'avg_rating',
  'tags',
  'description',
  'bpm'
].join(',');
const HARD_REJECT_PATTERNS = Object.freeze([
  { pattern: /\bnon[\s-]?commercial\b|\bcc[\s-]?by[\s-]?nc\b/i, reason: 'non-commercial license' },
  { pattern: /\bai[\s-]?generated\b|\bai voice\b|\budio\b|\bsuno\b/i, reason: 'AI-generated provenance' },
  { pattern: /\bcontent[\s-]?id\b|\bcopyright claim\b|\bcopyrighted\b/i, reason: 'copyright risk' },
  { pattern: /\bmale vocal\b|\bmale voice\b|\bpodcast\b|\baudiobook\b/i, reason: 'wrong source type' }
]);
const SOFT_RISK_PATTERNS = Object.freeze([
  { pattern: /\bcover song\b|\bremake\b|\bremix\b/i, reason: 'derivative-work wording' },
  { pattern: /\bfull song\b|\bverse\b|\bchorus\b/i, reason: 'could be too complete' },
  { pattern: /\blive recording\b|\bfield recording\b/i, reason: 'messier source capture' },
  { pattern: /\bprocessed\b|\bheavy fx\b|\breverb\b/i, reason: 'heavily processed' }
]);
const VOCAL_EVIDENCE_PATTERN = /\bfemale\b|\bvocal\b|\bvox\b|\bacapella\b|\bvoice\b|\bsinging\b/i;
const PRODUCTION_READY_PATTERN = /\bhook\b|\bphrase\b|\badlib\b|\bchop\b|\bloop\b|\bacapella\b/i;
const MINIMUM_PASSING_SCORE = 0.42;

const TEXTURE_PROFILES = Object.freeze({
  sultry: ['sultry', 'sensual', 'late-night', 'rnb', 'intimate'],
  airy: ['airy', 'lifted', 'bright', 'floaty', 'clean'],
  breathy: ['breathy', 'whispered', 'close-mic', 'soft', 'hushed'],
  ethereal: ['ethereal', 'ghostly', 'haunting', 'reverb', 'padlike'],
  soulful: ['soulful', 'warm', 'gospel-tinged', 'hooky', 'emotive'],
  cinematic: ['cinematic', 'dramatic', 'wide', 'tense', 'atmospheric']
});

const FORMAT_PROFILES = Object.freeze({
  hooks: ['hook', 'topline', 'catchy chorus', 'loop'],
  adlibs: ['adlib', 'shot', 'throw', 'vocal stab'],
  loops: ['loop', 'acapella loop', 'phrase loop', 'vocal loop'],
  phrases: ['phrase', 'one-liner', 'vocal phrase', 'topline phrase'],
  choirs: ['choir', 'stack', 'ensemble', 'ooh', 'aah'],
  spoken: ['spoken word', 'spoken', 'female voice', 'vocal one-shot']
});

const SOURCE_CATALOG = Object.freeze([
  {
    id: 'freesound',
    name: 'Freesound',
    access: 'free',
    rights: 'Use only results whose license works for your track. CC0 is safest; Attribution needs credit.',
    description: 'Best for raw vocals, breaths, phrases, weird hooks, and fast creative digging.',
    href: (query) => `https://freesound.org/search/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'pixabay',
    name: 'Pixabay',
    access: 'free',
    rights: 'Check the Pixabay Content License on the item page before using a result in production.',
    description: 'Good for royalty-free voice FX and cleaner vocal textures.',
    href: (query) => `https://pixabay.com/sound-effects/search/${encodeURIComponent(query)}/`
  },
  {
    id: 'splice',
    name: 'Splice',
    access: 'paid',
    rights: 'Royalty-free under your Splice plan and terms after download.',
    description: 'Best quality ceiling for polished female hooks and toplines in this lane.',
    href: () => 'https://splice.com/sounds/instruments/vocals-female/samples'
  },
  {
    id: 'looperman',
    name: 'Looperman',
    access: 'free',
    rights: 'Usage depends on Looperman rules and the uploader terms shown on each loop page.',
    description: 'Useful for quick idea hunting if you are willing to vet each uploader and license.',
    href: () => 'https://www.looperman.com/loops/tags/free-vocal-loop-female-loops-samples-sounds-wavs-download'
  }
]);

function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function splitTerms(value) {
  return normalizeString(value)
    .split(/[\s,/-]+/g)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeInput(payload = {}) {
  return {
    bpm: clampInteger(payload.bpm, 1, 300, 136),
    key: normalizeString(payload.key) || null,
    texture: normalizeString(payload.texture, 'sultry').toLowerCase(),
    format: normalizeString(payload.format, 'hooks').toLowerCase(),
    accessFilter: normalizeString(payload.accessFilter, 'all').toLowerCase(),
    extraTerms: normalizeString(payload.extraTerms),
    limit: clampInteger(payload.limit, 1, MAX_RESULTS, 8)
  };
}

function getSearchConfiguration() {
  return {
    openaiEnabled: typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0,
    freesoundEnabled: typeof process.env.FREESOUND_API_KEY === 'string' && process.env.FREESOUND_API_KEY.length > 0,
    openaiModel: DEFAULT_OPENAI_MODEL,
    supportedSources: SOURCE_CATALOG.map((source) => ({
      id: source.id,
      name: source.name,
      access: source.access
    }))
  };
}

function getLaneDescriptor(input) {
  const textureProfile = TEXTURE_PROFILES[input.texture] || TEXTURE_PROFILES.sultry;
  const formatProfile = FORMAT_PROFILES[input.format] || FORMAT_PROFILES.hooks;
  const bpmLane = input.bpm ? `${input.bpm} BPM` : 'mid-130s BPM';
  const extraTerms = normalizeString(input.extraTerms);

  return {
    summary: `UKG / bassline / speed garage lane around ${bpmLane}, chasing ${input.texture} female ${input.format}.`,
    tags: [...textureProfile, ...formatProfile, 'female vocal', 'ukg', 'bassline', 'speed garage'],
    extraTerms
  };
}

function buildDeterministicPlan(input) {
  const lane = getLaneDescriptor(input);
  const primaryQuery = [
    'female vocal',
    input.texture,
    input.format,
    'ukg',
    'bassline',
    lane.extraTerms
  ].filter(Boolean).join(' ');

  const secondaryQuery = [
    'female rnb vocal',
    input.format,
    'speed garage',
    lane.extraTerms
  ].filter(Boolean).join(' ');

  const tertiaryQuery = [
    'female vocal',
    input.texture,
    '2-step',
    'hook',
    lane.extraTerms
  ].filter(Boolean).join(' ');

  const providers = [
    { source: 'freesound', query: primaryQuery },
    { source: 'pixabay', query: primaryQuery },
    { source: 'splice', query: `${input.texture} ${input.format} ${input.bpm} bpm ukg` },
    { source: 'looperman', query: `${input.texture} female vocal loop ${input.bpm} bpm` }
  ];

  return {
    laneSummary: lane.summary,
    tagTargets: lane.tags.slice(0, 10),
    queryVariants: [primaryQuery, secondaryQuery, tertiaryQuery].slice(0, MAX_QUERY_VARIANTS),
    providerPrompts: providers
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') {
        return content.text;
      }
      if (content?.type === 'refusal' && typeof content.refusal === 'string') {
        throw new Error(content.refusal);
      }
    }
  }

  throw new Error('OpenAI did not return text output.');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return response.json();
}

async function buildOpenAiPlan(input) {
  if (!process.env.OPENAI_API_KEY) {
    return buildDeterministicPlan(input);
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['laneSummary', 'tagTargets', 'queryVariants', 'providerPrompts'],
    properties: {
      laneSummary: { type: 'string' },
      tagTargets: {
        type: 'array',
        maxItems: 10,
        items: { type: 'string' }
      },
      queryVariants: {
        type: 'array',
        minItems: 2,
        maxItems: MAX_QUERY_VARIANTS,
        items: { type: 'string' }
      },
      providerPrompts: {
        type: 'array',
        minItems: 3,
        maxItems: SOURCE_CATALOG.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'query'],
          properties: {
            source: {
              type: 'string',
              enum: SOURCE_CATALOG.map((source) => source.id)
            },
            query: { type: 'string' }
          }
        }
      }
    }
  };

  const payload = await fetchJson(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      instructions: [
        'You are building legal search plans for licensable female vocal samples.',
        'The target lane is UK garage / bassline / speed garage in the Silva Bumpa, Sammy Virji, Oppidan, Bushbaby world.',
        'Favour soulful, breathy, ghostly, R&B-leaning female hooks, phrases, loops, ad-libs, and chopped toplines.',
        'Never suggest scraping, ripping, or copyrighted song vocals.',
        'Return concise search queries that work well on Freesound, Pixabay, Splice, and Looperman.'
      ].join(' '),
      input: JSON.stringify({
        bpm: input.bpm,
        key: input.key,
        texture: input.texture,
        format: input.format,
        accessFilter: input.accessFilter,
        extraTerms: input.extraTerms
      }),
      max_output_tokens: 500,
      text: {
        format: {
          type: 'json_schema',
          name: 'vocal_search_plan',
          strict: true,
          schema
        }
      }
    })
  });

  const parsed = JSON.parse(extractResponseText(payload));
  const fallback = buildDeterministicPlan(input);

  return {
    laneSummary: normalizeString(parsed.laneSummary, fallback.laneSummary),
    tagTargets: Array.isArray(parsed.tagTargets) && parsed.tagTargets.length > 0
      ? parsed.tagTargets.map((value) => normalizeString(value)).filter(Boolean).slice(0, 10)
      : fallback.tagTargets,
    queryVariants: Array.isArray(parsed.queryVariants) && parsed.queryVariants.length > 0
      ? parsed.queryVariants.map((value) => normalizeString(value)).filter(Boolean).slice(0, MAX_QUERY_VARIANTS)
      : fallback.queryVariants,
    providerPrompts: Array.isArray(parsed.providerPrompts) && parsed.providerPrompts.length > 0
      ? parsed.providerPrompts
        .map((entry) => ({
          source: normalizeString(entry?.source).toLowerCase(),
          query: normalizeString(entry?.query)
        }))
        .filter((entry) => entry.query && SOURCE_CATALOG.some((source) => source.id === entry.source))
      : fallback.providerPrompts
  };
}

function isCommercialFriendlyLicense(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('noncommercial')) return false;
  if (normalized.includes('sampling+')) return false;
  return normalized.includes('creative commons 0') || normalized.includes('attribution');
}

function buildFreesoundFilter(input) {
  const filters = ['duration:[1 TO 20]', 'avg_rating:[3 TO *]'];
  if (input.bpm) {
    filters.push(`bpm:[${Math.max(input.bpm - 2, 1)} TO ${input.bpm + 2}]`);
  }

  if (['hooks', 'loops', 'phrases'].includes(input.format)) {
    filters.push('(tag:vocal OR tag:vox OR tag:acapella OR tag:loop)');
  } else {
    filters.push('(tag:vocal OR tag:vox OR tag:acapella)');
  }

  return filters.join(' ');
}

async function searchFreesound(query, input) {
  if (!process.env.FREESOUND_API_KEY) return [];

  const url = new URL(FREESOUND_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('page_size', '10');
  url.searchParams.set('fields', FREESOUND_FIELDS);
  url.searchParams.set('filter', buildFreesoundFilter(input));

  const payload = await fetchJson(url.toString(), {
    headers: {
      Authorization: `Token ${process.env.FREESOUND_API_KEY}`
    }
  });

  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results
    .filter((item) => item && isCommercialFriendlyLicense(item.license))
    .map((item) => ({
      id: `freesound:${item.id}`,
      provider: 'freesound',
      title: normalizeString(item.name, `Freesound ${item.id}`),
      creator: normalizeString(item.username) || null,
      license: normalizeString(item.license) || null,
      duration: typeof item.duration === 'number' ? item.duration : null,
      bpm: typeof item.bpm === 'number' ? item.bpm : null,
      avgRating: typeof item.avg_rating === 'number' ? item.avg_rating : null,
      sourceUrl: normalizeString(item.url) || null,
      previewUrl: item?.previews?.['preview-hq-mp3'] || item?.previews?.['preview-lq-mp3'] || null,
      description: normalizeString(item.description) || null,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
      query
    }));
}

function buildScoreContext(input, plan) {
  const terms = new Set([
    input.texture,
    input.format,
    ...splitTerms(input.extraTerms),
    ...plan.tagTargets.map((value) => value.toLowerCase())
  ]);
  terms.delete('');
  return [...terms];
}

function scoreItem(item, input, plan) {
  const searchTerms = buildScoreContext(input, plan);
  const haystack = [
    item.title,
    item.description,
    Array.isArray(item.tags) ? item.tags.join(' ') : ''
  ].join(' ').toLowerCase();

  let score = 0.2;
  const reasons = [];
  const riskFlags = [];
  const qualityFlags = [];

  for (const rule of HARD_REJECT_PATTERNS) {
    if (rule.pattern.test(haystack)) {
      return {
        ...item,
        rejected: true,
        score: 0,
        riskFlags: [rule.reason],
        qualityFlags: [],
        confidenceLabel: 'reject',
        matchReason: rule.reason
      };
    }
  }

  for (const rule of SOFT_RISK_PATTERNS) {
    if (rule.pattern.test(haystack)) {
      score -= 0.08;
      riskFlags.push(rule.reason);
    }
  }

  if (item.previewUrl) {
    score += 0.08;
    reasons.push('preview ready');
  } else {
    riskFlags.push('no preview');
  }

  if (item.license) {
    if (/creative commons 0/i.test(item.license)) {
      score += 0.18;
      reasons.push('CC0');
    } else if (/attribution/i.test(item.license)) {
      score += 0.12;
      reasons.push('commercial-friendly CC');
    }
  } else {
    riskFlags.push('license unclear');
  }

  if (typeof item.avgRating === 'number') {
    score += Math.min(Math.max(item.avgRating, 0), 5) / 5 * 0.16;
    if (item.avgRating >= 4) {
      reasons.push('high-rated');
    }
  } else {
    qualityFlags.push('unrated');
  }

  if (input.bpm && typeof item.bpm === 'number') {
    const delta = Math.abs(item.bpm - input.bpm);
    const bpmScore = Math.max(0, 0.26 - (delta * 0.07));
    score += bpmScore;
    if (delta <= 1) reasons.push(`${item.bpm} BPM`);
    if (delta >= 5) riskFlags.push('weak BPM fit');
  } else {
    riskFlags.push('missing BPM');
  }

  if (typeof item.duration === 'number') {
    if (item.duration >= 1.5 && item.duration <= 12) {
      score += 0.08;
      qualityFlags.push('workable length');
    } else if (item.duration > 20) {
      score -= 0.12;
      riskFlags.push('too long');
    } else if (item.duration < 1) {
      score -= 0.08;
      riskFlags.push('too short');
    }
  } else {
    riskFlags.push('missing duration');
  }

  let termMatches = 0;
  for (const term of searchTerms) {
    if (haystack.includes(term)) {
      termMatches += 1;
      score += 0.035;
    }
  }
  if (termMatches > 0) {
    reasons.push(`${termMatches} style hits`);
  }

  if (!VOCAL_EVIDENCE_PATTERN.test(haystack)) {
    score -= 0.18;
    riskFlags.push('weak vocal evidence');
  } else {
    qualityFlags.push('vocal evidence');
  }

  if (PRODUCTION_READY_PATTERN.test(haystack)) {
    score += 0.08;
    qualityFlags.push('production-ready wording');
  }

  if (/\bmale\b|\binstrumental\b/.test(haystack)) {
    score -= 0.2;
    riskFlags.push('wrong performer/type');
  }

  const normalizedScore = Number(score.toFixed(3));
  const confidenceLabel = normalizedScore >= 0.82
    ? 'clean'
    : normalizedScore >= 0.62
      ? 'strong'
      : normalizedScore >= MINIMUM_PASSING_SCORE
        ? 'review'
        : 'reject';

  return {
    ...item,
    rejected: confidenceLabel === 'reject',
    score: normalizedScore,
    riskFlags: [...new Set(riskFlags)].slice(0, 4),
    qualityFlags: [...new Set(qualityFlags)].slice(0, 4),
    confidenceLabel,
    matchReason: reasons.slice(0, 3).join(', ') || 'style match'
  };
}

function dedupeAndRank(items, input, plan, limit) {
  const byId = new Map();

  items.forEach((item) => {
    if (!item?.id) return;
    const scored = scoreItem(item, input, plan);
    const existing = byId.get(item.id);
    if (!existing || scored.score > existing.score) {
      byId.set(item.id, scored);
    }
  });

  return [...byId.values()]
    .filter((item) => !item.rejected && item.score >= MINIMUM_PASSING_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

function buildLaunchers(plan, input) {
  const promptBySource = new Map();
  (plan.providerPrompts || []).forEach((entry) => {
    if (!entry?.source || !entry?.query) return;
    promptBySource.set(entry.source, entry.query);
  });

  return SOURCE_CATALOG
    .filter((source) => input.accessFilter === 'all' || source.access === input.accessFilter)
    .map((source) => {
      const query = promptBySource.get(source.id) || plan.queryVariants[0] || buildDeterministicPlan(input).queryVariants[0];
      return {
        id: source.id,
        name: source.name,
        access: source.access,
        rights: source.rights,
        description: source.description,
        hint: query,
        href: source.href(query)
      };
    });
}

async function searchVocals(payload = {}) {
  const input = normalizeInput(payload);
  const config = getSearchConfiguration();
  const warnings = [];

  let plan;
  try {
    plan = await buildOpenAiPlan(input);
  } catch (error) {
    console.error('Failed to build OpenAI vocal plan:', error);
    plan = buildDeterministicPlan(input);
    warnings.push('OpenAI planning failed, so the query plan fell back to a deterministic lane preset.');
  }

  if (!config.openaiEnabled) {
    warnings.push('OPENAI_API_KEY is not configured. Search planning is using a built-in fallback lane profile.');
  }

  let freesoundItems = [];
  if (config.freesoundEnabled) {
    const settled = await Promise.allSettled(
      plan.queryVariants.slice(0, 3).map((query) => searchFreesound(query, input))
    );

    freesoundItems = settled.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value;
      console.error('Freesound search failed:', result.reason);
      warnings.push('One of the Freesound searches failed.');
      return [];
    });
  } else {
    warnings.push('FREESOUND_API_KEY is not configured. Inline results are unavailable, but provider launchers still work.');
  }

  const results = dedupeAndRank(freesoundItems, input, plan, input.limit);
  if (freesoundItems.length > 0 && results.length === 0) {
    warnings.push('Strict anti-fake filtering rejected every inline candidate in this pass.');
  }

  return {
    version: 1,
    query: input,
    configuration: config,
    lane: {
      summary: plan.laneSummary,
      tagTargets: plan.tagTargets,
      queryVariants: plan.queryVariants
    },
    results,
    launchers: buildLaunchers(plan, input),
    warnings
  };
}

module.exports = {
  getSearchConfiguration,
  searchVocals
};
