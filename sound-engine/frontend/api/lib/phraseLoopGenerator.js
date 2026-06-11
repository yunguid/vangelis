const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.5';

const PHONEME_GROUPS = ['AA', 'AW', 'ER', 'IY', 'AE', 'OW', 'AY', 'UW'];
const CARRIER_OPTIONS = new Set(PHONEME_GROUPS);
const GLIDE_OPTIONS = new Set(['low', 'medium', 'high']);

// Keys as a root MIDI note plus an ascending scale (semitone offsets). The
// melody is spelled by walking scale degrees, so every generated line stays in
// key and the corpus never drifts into atonal confetti.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

function noteToMidi(name) {
  const m = name.match(/^([A-G])([b#]?)(-?\d+)$/);
  if (!m) return null;
  let semi = NOTE_SEMITONES[m[1]];
  if (m[2] === '#') semi += 1;
  else if (m[2] === 'b') semi -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + semi;
}

function midiToNote(midi) {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${octave}`;
}

const KEYS = {
  'F# minor': { root: noteToMidi('F#3'), scale: MINOR },
  'C# minor': { root: noteToMidi('C#3'), scale: MINOR },
  'A# minor': { root: noteToMidi('A#2'), scale: MINOR },
  'G# minor': { root: noteToMidi('G#2'), scale: MINOR },
  'D# minor': { root: noteToMidi('D#3'), scale: MINOR },
  'F minor': { root: noteToMidi('F3'), scale: MINOR },
  'E minor': { root: noteToMidi('E3'), scale: MINOR },
  'A dorian': { root: noteToMidi('A2'), scale: DORIAN },
  'D lydian': { root: noteToMidi('D3'), scale: LYDIAN }
};

// Map a scale degree (can be negative / above the octave) to a MIDI note.
function degreeToMidi(key, degree) {
  const len = key.scale.length;
  const octave = Math.floor(degree / len);
  const step = ((degree % len) + len) % len;
  return key.root + octave * 12 + key.scale[step];
}

// Articulation comes from consonant onsets/codas riding a stable carrier vowel
// — the "harder / better / faster" groove. The carrier vowel is substituted in
// so the sung colour stays consistent while the consonants give it rhythm.
const ONSETS = ['HH', 'M', 'N', 'L', 'R', 'W', 'V', 'D', 'B', 'S', 'T', 'F'];
const CODAS = ['R', 'N', 'L', 'S', 'T', '', '', ''];
// A few fixed pivot syllables for colour hits at lifts and turnarounds.
const PIVOTS = ['Y UW', 'OW V ER', 'AA R', 'EY K', 'IH T', 'AW ER'];

const LOOP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'bpm', 'bars', 'notes'],
  properties: {
    score: {
      type: 'string',
      description: 'A klattsch score string beginning with rNN and containing note directives like bC#4 ( HH AA R ).'
    },
    bpm: { type: 'number' },
    bars: { type: 'number' },
    notes: { type: 'string' }
  }
};

const AVOID_SHAPES = [
  'a flat chant stuck on one or two pitches',
  'one vowel per note with no consonant articulation (vowel confetti)',
  'a melody that never returns to the root or tonic',
  'random notes with no recurring motif',
  'straight ladder scales running all the way up or down',
  'four notes, pause, four notes, pause blocks',
  'root-third-fifth chord spelling in stacked blocks',
  'ABAB pitch ping-pong between just two notes',
  'copy-pasted transposition squares with no variation',
  'constant r50-r70 stutter with no melodic line',
  'busy high-register chatter with no low bass anchor',
  'sticky pitch deltas (AA+12) that make the whole loop drift sharp',
  'changing the carrier vowel on every single note',
  'pleasant but forgettable chord exercises that do not hook'
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

function chooseKey(value) {
  return KEYS[value] ? value : 'F# minor';
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

function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

// Build one sung syllable as consonant-onset + carrier vowel + optional coda.
function makeSyllable(random, carrier, { lead = true, weight = 0.5 } = {}) {
  const onset = lead && random() < 0.85 ? `${pick(random, ONSETS)} ` : '';
  const coda = random() < weight ? ` ${pick(random, CODAS)}` : '';
  return `${onset}${carrier}${coda}`.replace(/\s+/g, ' ').trim();
}

// The melodic engine: a recurring motif is the "law" of the loop. We state a
// low/mid motif, answer it up high, and resolve back to the tonic so the loop
// seam is seamless.
const MOTIFS = [
  [0, 2, 4, 2],
  [0, 4, 7, 4],
  [7, 4, 2, 0],
  [0, 2, 3, 0],
  [4, 2, 0, -3],
  [0, -3, 0, 4]
];

function buildScore({ key = 'F# minor', bpm = 124, density = 'high', phrase = '', carrier = 'AA', glide = 'medium' } = {}) {
  const keyName = chooseKey(key);
  const keyData = KEYS[keyName];
  const rate = Math.round(coerceNumber(bpm, 124, 90, 180) <= 0 ? 124 : (60000 / coerceNumber(bpm, 124, 90, 180)) / 2);
  const safeCarrier = coerceChoice(carrier, CARRIER_OPTIONS, 'AA');
  const safeGlide = coerceChoice(glide, GLIDE_OPTIONS, 'medium');
  const random = seededRandom(hashString(`${keyName}:${density}:${bpm}:${phrase}:${safeCarrier}:${safeGlide}`));

  const motif = pick(random, MOTIFS);
  const repeats = density === 'wide-open' ? 2 : density === 'very high' ? 4 : 3;
  const codaWeight = density === 'very high' ? 0.6 : density === 'wide-open' ? 0.3 : 0.45;
  const ornamentChance = safeGlide === 'high' ? 0.32 : safeGlide === 'low' ? 0.06 : 0.16;

  const cells = [];
  const emit = (midi, syllable) => {
    cells.push(`b${midiToNote(midi)} ( ${syllable} )`);
  };

  // Bass anchor pickup: tonic dropped an octave, two articulated hits.
  emit(degreeToMidi(keyData, 0) - 12, makeSyllable(random, safeCarrier, { weight: 0.7 }));
  emit(degreeToMidi(keyData, 2) - 12, makeSyllable(random, safeCarrier, { weight: 0.4 }));

  // State the motif, walking it up then back down the scale so the line
  // arches instead of climbing monotonically into a shrill register.
  const arch = [0, 2, 3, 4, 2, 1];
  for (let r = 0; r < repeats; r += 1) {
    const transpose = arch[r % arch.length];
    for (let i = 0; i < motif.length; i += 1) {
      const midi = degreeToMidi(keyData, motif[i] + transpose);
      if (random() < ornamentChance) {
        // Transient Hz bend on the carrier vowel — springs back, no drift.
        const onset = random() < 0.85 ? `${pick(random, ONSETS)} ` : '';
        const bend = 8 + Math.floor(random() * 18);
        emit(midi, `${onset}${safeCarrier}(+${bend})`);
      } else {
        emit(midi, makeSyllable(random, safeCarrier, { weight: codaWeight }));
      }
    }
  }

  // High answer: climb to a bright degree, shimmer, then step down with a pivot.
  const peak = degreeToMidi(keyData, 7 + Math.min(repeats, 2));
  cells.push(`v${safeGlide === 'high' ? 6 : 4} b${midiToNote(peak)} ( ${pick(random, PIVOTS)} )`);
  cells.push(`b${midiToNote(degreeToMidi(keyData, 6 + repeats))} ( ${makeSyllable(random, safeCarrier, { weight: 0.3 })} )`);
  cells.push(`b${midiToNote(degreeToMidi(keyData, 4 + repeats))} ( ${makeSyllable(random, safeCarrier, { weight: 0.5 })} )`);
  cells.push(`v b${midiToNote(degreeToMidi(keyData, 2))} ( ${pick(random, PIVOTS)} )`);

  // Resolution back to the tonic for a seamless loop seam.
  emit(degreeToMidi(keyData, 0), makeSyllable(random, safeCarrier, { weight: 0.3 }));
  cells.push(`s1.1 b${midiToNote(degreeToMidi(keyData, 0) - 12)} ( ${safeCarrier} V ER )`);

  return `r${rate} s1.04 g0.8 ${cells.join(' ')}`;
}

function fallbackLoop(options = {}) {
  const bpm = Math.round(coerceNumber(options.bpm, 124, 90, 180));
  const key = coerceText(options.key, 'F# minor');
  return {
    score: buildScore({
      key,
      bpm,
      density: coerceText(options.density, 'high'),
      phrase: coerceText(options.phrase || options.mood, ''),
      carrier: coerceChoice(options.carrier, CARRIER_OPTIONS, 'AA'),
      glide: coerceChoice(options.glide, GLIDE_OPTIONS, 'medium')
    }),
    bpm,
    bars: 8,
    notes: `${chooseKey(key)} motif loop: low anchor states the law, lifts to a high answer, resolves home.`
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
    phrase: coerceText(request.phrase, 'work it harder'),
    variation: coerceText(request.variation, ''),
    mood: coerceText(request.mood, 'beautiful late-night electronic vocal loop'),
    key: coerceText(request.key, 'F# minor'),
    bpm: coerceNumber(request.bpm, 124, 90, 180),
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
      prompt_cache_key: 'vangelis-klattsch-score-v7',
      max_output_tokens: 9000,
      instructions: [
        'You write original klattsch scores for a retro parallel-formant speech synth. The result must feel like a beautiful, hypnotic electronic VOCAL loop — Daft Punk "Harder, Better, Faster, Stronger" is the north star: rhythmic consonants articulating an emotional, melodic vocal line that can loop for minutes without getting old.',
        'KLATTSCH GRAMMAR (whitespace separated):',
        '- rN sets ms per rhythmic slot. A parenthesized group ( ... ) is ONE sung syllable that occupies ONE slot; the phonemes inside it share that slot. So ( HH AA R ) is a single sung "har", not three notes.',
        '- bNote sets the absolute pitch for what follows, e.g. bC#4. THE MELODY IS THE SEQUENCE OF bNote VALUES, one per group. Put a bNote before (almost) every group.',
        '- Pitch ornaments are in Hz, not semitones. AA(+20) inside a group is a transient upward bend that springs back. AA+20 WITHOUT parentheses is sticky and permanently raises pitch — do NOT use sticky deltas, they make the loop drift sharp.',
        '- ARPABET phonemes only. Stress a syllable with ! e.g. AA!. Pause with pN (ms) sparingly.',
        '- Expressive directives: s scale/voice-size, v vibrato depth, w vibrato rate, m tremolo, n tremolo rate, h breath, t brightness, g glottal effort. A BARE letter (just v, or s) RESETS that knob to baseline — use that to end a swell.',
        'COMPOSITION METHOD:',
        '1. Pick a 4-bar harmonic map in the requested key (e.g. minor i-VI-III-VII, i-v-VI-iv, dorian i-IV-v-VII, lydian I-II-vii-I).',
        '2. Invent ONE 3-4 note melodic motif (the "law"). State it low, then repeat it transposed up the scale for lift. A recurring motif is what makes a loop mesmerizing.',
        '3. Anchor the loop with a low bass note (around bG2-bA2) at phrase starts, cruise in the mid register (bC3-bC4), and reach a bright high answer (bC4-bG#4) once per loop.',
        '4. Resolve the last group back to the tonic so the loop seam is seamless.',
        'VOICE / ARTICULATION:',
        '- Ride the requested carrier vowel as the main sung colour. Articulate the groove with consonant onsets and codas (HH, M, N, L, R, W, V, D, B, S, T and codas R, N, L, S, T) the way "harder/better/faster/stronger" does. Do NOT change the vowel every note — change it only at pivots, lifts, and turnarounds.',
        '- Short evocative robot-vocal phrasing is welcome (e.g. broken into syllable groups), but never quote real copyrighted lyrics.',
        'GLIDE: low = almost no ornaments; medium = a few transient AA(+N) bends at emotional turns; high = more bends, still smooth and resolved.',
        'TIMING: one 4/4 bar ~ 1920 ms at 125 BPM (quarter 480, eighth 240, sixteenth 120). Set r near 60000/BPM/2 for an eighth-note pulse. Return 24-64 groups (fewer if density is wide-open).',
        `AVOID these shapes:\n- ${AVOID_SHAPES.join('\n- ')}`,
        'If the line starts resembling any avoided shape, rewrite the contour before finalizing.',
        'WORKED EXAMPLE (F# minor, do not copy verbatim): r236 s1.05 g0.8 bF#2 ( W ER K ) bC#3 ( IH T ) bF#3 ( HH AA R ) bA3 ( D ER ) bC#4 ( B EH ) bB3 ( T ER ) bA3 ( F AE S ) bF#3 ( T ER ) bE3 ( S T R AO NG ) bC#3 ( G ER ) ... v4 bF#4 ( AW ER ) ... s1.1 bF#2 ( OW V ER )',
        'The notes field briefly names the harmonic map and emotional contour, e.g. "F# minor i-III-VII, low motif lifts to a bright high answer and resolves home."',
        'Output only valid JSON for the schema. No prose, comments, or lyrics inside the score.'
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
