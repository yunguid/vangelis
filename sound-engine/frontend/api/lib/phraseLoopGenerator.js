const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.5';

const NOTES = ['C', 'C#', 'D', 'D#', 'F', 'G', 'G#', 'A#'];
const PHONEME_GROUPS = ['AA', 'AW', 'ER', 'IY', 'AE', 'OW', 'AY', 'UW'];
const CARRIER_OPTIONS = new Set(PHONEME_GROUPS);
const GLIDE_OPTIONS = new Set(['low', 'medium', 'high']);
const ROOTS = {
  'F# minor': ['F#3', 'G#3', 'A3', 'C#4', 'E4', 'F#4', 'G#4', 'A4', 'C#5'],
  'C# minor': ['C#3', 'D#3', 'E3', 'G#3', 'B3', 'C#4', 'D#4', 'E4', 'G#4', 'C#5'],
  'A# minor': ['A#2', 'C3', 'C#3', 'D#3', 'F3', 'F#3', 'G#3', 'A#3', 'C4', 'C#4', 'D#4', 'F4', 'F#4', 'G#4', 'A#4', 'C5', 'C#5', 'D#5', 'F5'],
  'G# minor': ['G#2', 'A#2', 'B2', 'C#3', 'D#3', 'E3', 'F#3', 'G#3', 'B3', 'C#4', 'D#4', 'E4', 'F#4', 'G#4', 'B4', 'C#5', 'D#5'],
  'D# minor': ['D#3', 'F3', 'F#3', 'G#3', 'A#3', 'B3', 'C#4', 'D#4', 'F#4', 'G#4', 'A#4', 'B4', 'C#5', 'D#5', 'F#5'],
  'F minor': ['F2', 'G2', 'G#2', 'A#2', 'C3', 'C#3', 'D#3', 'F3', 'G#3', 'A#3', 'C4', 'C#4', 'D#4', 'F4', 'G#4', 'C5'],
  'A dorian': ['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'C4', 'E4', 'G4'],
  'E minor': ['E2', 'F#2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'G3', 'B3', 'D4'],
  'D lydian': ['D3', 'E3', 'F#3', 'G#3', 'A3', 'B3', 'C#4', 'D4', 'F#4', 'A4']
};
const CONSONANT_GROUPS = ['( HH AA )', '( V OW )', '( R AA )', '( D ER )', '( M IY )', '( T AA )'];

const LOOP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'bpm', 'bars', 'notes'],
  properties: {
    score: {
      type: 'string',
      description: 'A klattsch score string beginning with rNN and containing note directives like bC5 ( AA ).'
    },
    bpm: { type: 'number' },
    bars: { type: 'number' },
    notes: { type: 'string' }
  }
};

const AVOID_SHAPES = [
  'four notes, pause, four notes, pause',
  'root-third-fifth chord spelling blocks',
  'ABAB pitch ping-pong',
  'copy-pasted transposition squares',
  'straight ladder scales up or down',
  'constant r50-r60 stutter streams',
  'vowel-per-note confetti',
  'mostly OW/ER/AW mood coloring with no melody',
  'AE/IY alternation as the main sound',
  'generic DAW arpeggiator output',
  'speech-like word syllables instead of a smooth carrier vowel',
  'busy high-register chatter with no low anchor',
  'too many rests or chopped silence',
  'pleasant but forgettable chord exercises'
];

function coerceText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 220) : fallback;
}

function coerceNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function coerceChoice(value, options, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return options.has(normalized) ? normalized : fallback;
}

function chooseScale(value) {
  return ROOTS[value] ? value : 'F# minor';
}

function hashString(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function buildCarrierGroup(carrier, random, glide) {
  const glideChance = glide === 'high' ? 0.22 : glide === 'low' ? 0.06 : 0.12;
  const stressChance = glide === 'high' ? 0.12 : 0.06;

  if (random() < glideChance) {
    const lift = glide === 'high' ? 18 : glide === 'low' ? 6 : 12;
    return `( ${carrier}(+${lift}) )`;
  }

  if (random() < stressChance) {
    return `( ${carrier}! )`;
  }

  return `( ${carrier} )`;
}

function buildScore({ key = 'F# minor', bpm = 144, density = 'high', phrase = '', carrier = 'AA', glide = 'medium' } = {}) {
  const scaleKey = chooseScale(key);
  const pool = ROOTS[scaleKey];
  const dense = density === 'very high' ? 1 : density === 'wide-open' ? 3 : 2;
  const rate = Math.round(coerceNumber(bpm, 144, 90, 180));
  const safeCarrier = coerceChoice(carrier, CARRIER_OPTIONS, 'AA');
  const safeGlide = coerceChoice(glide, GLIDE_OPTIONS, 'medium');
  const random = seededRandom(hashString(`${scaleKey}:${density}:${rate}:${phrase}:${safeCarrier}:${safeGlide}`));
  const shapes = [
    [8, 6, 3, 0, 1, 2, 3, 5],
    [0, 2, 3, 5, 2, 3, 5, 7],
    [6, 5, 4, 3, 5, 6, 7, 8],
    [2, 4, 6, 8, 6, 4, 3, 1],
    [5, 2, 3, 5, 6, 3, 1, 0]
  ];
  const cells = [];
  const passes = density === 'wide-open' ? 2 : 3;

  for (let pass = 0; pass < passes; pass += 1) {
    for (let section = 0; section < shapes.length; section += 1) {
      const shape = shapes[section];
      const shift = Math.floor(random() * shape.length);
      const invert = random() > 0.72;
      for (let index = 0; index < shape.length; index += 1) {
        if (dense > 1 && (index + section) % dense === 1) continue;
        const shapeIndex = invert ? shape.length - 1 - index : index;
        const noteIndex = shape[(shapeIndex + pass + shift) % shape.length] % pool.length;
        const note = pool[noteIndex];
        const groupPool = random() > 0.9 ? CONSONANT_GROUPS : null;
        const group = groupPool
          ? groupPool[(section + index + pass + shift) % groupPool.length]
          : buildCarrierGroup(safeCarrier, random, safeGlide);
        cells.push(`b${note} ${group}`);
      }
      const turnaround = pool[(section * 2 + pass) % pool.length];
      cells.push(`b${turnaround} ${buildCarrierGroup(safeCarrier, random, safeGlide)}`);
    }
  }

  return `r${rate} ${cells.join(' ')}`;
}

function fallbackLoop(options = {}) {
  const bpm = Math.round(coerceNumber(options.bpm, 144, 90, 180));
  return {
    score: buildScore({
      key: coerceText(options.key, 'F# minor'),
      bpm,
      density: coerceText(options.density, 'high'),
      phrase: coerceText(options.phrase || options.mood, ''),
      carrier: coerceChoice(options.carrier, CARRIER_OPTIONS, 'AA'),
      glide: coerceChoice(options.glide, GLIDE_OPTIONS, 'medium')
    }),
    bpm,
    bars: 8,
    notes: 'Klattsch score loop built from fast note directives and vowel phoneme groups.'
  };
}

function collectOutputText(responseJson) {
  if (typeof responseJson?.output_text === 'string' && responseJson.output_text.length > 0) {
    return responseJson.output_text;
  }

  const parts = [];
  for (const output of responseJson?.output || []) {
    for (const item of output?.content || []) {
      if (typeof item?.text === 'string') parts.push(item.text);
    }
  }
  return parts.join('\n').trim();
}

function normalizeScore(value, fallback) {
  if (typeof value !== 'string') return fallback.score;

  const compact = value
    .replace(/[^A-Za-z0-9#()+\-.,;!\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/^r\d+(?:\.\d+)?\s/.test(compact) || !/b[A-G](?:#|b)?-?\d+\s+\(/.test(compact)) {
    return fallback.score;
  }

  return compact.slice(0, 16000);
}

function normalizeLoop(loop, request) {
  const fallback = fallbackLoop(request);
  if (!loop || typeof loop !== 'object') return fallback;

  return {
    score: normalizeScore(loop.score, fallback),
    bpm: Math.round(coerceNumber(loop.bpm, fallback.bpm, 90, 180)),
    bars: Math.round(coerceNumber(loop.bars, fallback.bars, 2, 16)),
    notes: coerceText(loop.notes, fallback.notes)
  };
}

async function readOpenAiError(response) {
  const requestId = response.headers.get('x-request-id') || '';
  let body = null;

  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }

  const error = body?.error || {};
  return {
    status: response.status,
    requestId,
    code: error.code || '',
    type: error.type || '',
    message: error.message || `OpenAI request failed with ${response.status}.`
  };
}

function isQuotaError(error) {
  return (
    error?.code === 'insufficient_quota'
    || error?.type === 'insufficient_quota'
    || /quota|billing/i.test(error?.message || '')
  );
}

function createOpenAiFailure(message, statusCode, providerError) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  if (providerError) error.providerError = providerError;
  return error;
}

async function generatePhraseLoop(request = {}, env = process.env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MUSIC_MODEL || DEFAULT_MODEL;
  const normalizedRequest = {
    phrase: coerceText(request.phrase, 'AA'),
    variation: coerceText(request.variation, ''),
    mood: coerceText(request.mood, 'state of the art 1980 speech synth arpeggio'),
    key: coerceText(request.key, 'F# minor'),
    bpm: coerceNumber(request.bpm, 144, 90, 180),
    density: coerceText(request.density, 'very high'),
    carrier: coerceChoice(request.carrier, CARRIER_OPTIONS, 'AA'),
    glide: coerceChoice(request.glide, GLIDE_OPTIONS, 'medium')
  };

  if (!apiKey) {
    throw createOpenAiFailure('OPENAI_API_KEY is not configured for this server.', 500);
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'low' },
      prompt_cache_key: 'vangelis-klattsch-score-v6',
      max_output_tokens: 9000,
      instructions: [
        'Generate original klattsch score strings for a retro browser speech synthesizer that should feel like a melodic electronic vocal loop.',
        'Klattsch syntax is whitespace-separated. Use rN for per-phoneme duration in ms, pN for exact pauses, bNote for absolute pitch, parenthesized groups for one sung syllable slot, stress markers like AA!, transient pitch ornaments like AA(+12), and ARPABET phonemes only.',
        'The target feel is beautiful, emotional, cruising, and smooth: late-night electronic motion, gliding momentum, a little melancholy, a little lift, and a loop that can run for minutes without getting annoying.',
        'Think in shapes first. Make one long melodic ribbon with a low anchor, a mid-register cruise, a high answering lift, and a clean return to the downbeat.',
        'Before writing the score, internally choose a clear 4-bar or 8-bar harmonic map. Favor emotional electronic progressions such as i-VI-III-VII, i-v-VI-iv, i-III-VII-IV, i-VI-iv-V, dorian i-IV-v-VII, or lydian I-II-vii-I.',
        'Use note directives from roughly bG2 through bG#5. Wide octave displacement is good when it feels smooth and resolved. Chromatic neighbor turns are good when they add electronic emotion rather than randomness.',
        'The request includes carrier. Most of the loop should ride that carrier vowel as the sung voice color. Use vowel changes as rare color hits at pivots, lifts, or turnarounds. Do not change vowel on every note.',
        'The request includes glide. For glide=low, use very few pitch ornaments or stress marks. For glide=medium, add occasional transient ornaments at emotional turns. For glide=high, use more AA(+N)-style ornaments, but keep the melody smooth and resolved.',
        'One 4/4 bar can be treated as 1920 ms at 125 BPM. Quarter = 480 ms, eighth = 240 ms, sixteenth = 120 ms. For other BPM values, scale millisecond flags by 125 / BPM.',
        'Use r90-r120 as the main pulse, with occasional p40-p160 only where the phrase needs breath. Return 96-192 note events unless the density request is wide-open.',
        'Use expressive directives sparingly at musical moments: h0.03-h0.12 for breath before a phrase, s0.95-s1.14 for voice size changes, t0.05-t0.35 for brighter lifts, g0.65-g0.95 for emotional push, v2-v7 and w4-w7 for held shimmer, m0.05-m0.18 and n4-n9 for electronic tremolo.',
        `Avoid these output shapes:\n- ${AVOID_SHAPES.join('\n- ')}`,
        'If the score starts to resemble any avoided shape, change the contour before finalizing. Keep the final loop smooth, emotional, melodic, and cruising.',
        'The notes field should briefly name the harmonic map and emotional contour, for example: "F# minor i-VI-III-VII, lonely low motif opens into bright high answer."',
        'Avoid prose, comments, lyrics, real song quotes, or explanations inside the score.'
      ].join('\n'),
      input: JSON.stringify(normalizedRequest),
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'vangelis_klattsch_loop',
          strict: true,
          schema: LOOP_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    const providerError = await readOpenAiError(response);
    if (isQuotaError(providerError)) {
      throw createOpenAiFailure(
        'OpenAI rejected the request because this key/project has insufficient quota.',
        429,
        providerError
      );
    }

    throw createOpenAiFailure(
      `OpenAI request failed with ${providerError.status}.`,
      providerError.status || 502,
      providerError
    );
  }

  const responseJson = await response.json();
  if (responseJson.status && responseJson.status !== 'completed') {
    throw createOpenAiFailure(`OpenAI response ended as ${responseJson.status}.`, 502);
  }

  const outputText = collectOutputText(responseJson);
  try {
    const parsedLoop = JSON.parse(outputText);
    return {
      source: 'openai',
      model,
      warning: '',
      loop: normalizeLoop(parsedLoop, normalizedRequest)
    };
  } catch (_) {
    throw createOpenAiFailure('OpenAI response was not parseable loop JSON.', 502);
  }
}

module.exports = {
  fallbackLoop,
  generatePhraseLoop
};
