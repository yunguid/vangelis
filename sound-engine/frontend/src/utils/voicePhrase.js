import { compileString, renderToBuffer } from 'klattsch';

export const VOICE_BASE_FREQUENCY = 261.63;
export const DEFAULT_VOICE_TEXT = 'I am alive';

export const VOICE_PRESETS = [
  'I am alive',
  'hello world',
  'electric rain',
  'remember me',
  'speak friend'
];

const WORD_PHONEMES = {
  a: 'AH',
  again: 'AH G EH N',
  alive: 'AH L AY V',
  am: 'AE M',
  and: 'AE N D',
  are: 'AA R',
  be: 'B IY',
  better: 'B EH T ER',
  bright: 'B R AY T',
  burn: 'B ER N',
  can: 'K AE N',
  dark: 'D AA R K',
  digital: 'D IH JH IH T AH L',
  do: 'D UW',
  dream: 'D R IY M',
  electric: 'IH L EH K T R IH K',
  faster: 'F AE S T ER',
  friend: 'F R EH N D',
  from: 'F R AH M',
  ghost: 'G OW S T',
  harder: 'HH AA R D ER',
  hard: 'HH AA R D',
  hello: 'HH AH L OW',
  i: 'AY',
  in: 'IH N',
  is: 'IH Z',
  it: 'IH T',
  light: 'L AY T',
  love: 'L AH V',
  make: 'M EY K',
  me: 'M IY',
  moon: 'M UW N',
  more: 'M AO R',
  motion: 'M OW SH AH N',
  music: 'M Y UW Z IH K',
  never: 'N EH V ER',
  my: 'M AY',
  of: 'AH V',
  over: 'OW V ER',
  rain: 'R EY N',
  remember: 'R IH M EH M B ER',
  robot: 'R OW B AA T',
  say: 'S EY',
  speak: 'S P IY K',
  star: 'S T AA R',
  stronger: 'S T R AO NG ER',
  the: 'DH AH',
  this: 'DH IH S',
  tonight: 'T AH N AY T',
  to: 'T UW',
  vangelis: 'V AE N JH EH L IH S',
  voice: 'V OY S',
  we: 'W IY',
  work: 'W ER K',
  world: 'W ER L D',
  you: 'Y UW'
};

const LETTER_PHONEMES = {
  a: 'EY',
  b: 'B IY',
  c: 'S IY',
  d: 'D IY',
  e: 'IY',
  f: 'EH F',
  g: 'JH IY',
  h: 'EY CH',
  i: 'AY',
  j: 'JH EY',
  k: 'K EY',
  l: 'EH L',
  m: 'EH M',
  n: 'EH N',
  o: 'OW',
  p: 'P IY',
  q: 'K Y UW',
  r: 'AA R',
  s: 'EH S',
  t: 'T IY',
  u: 'Y UW',
  v: 'V IY',
  w: 'D AH B AH L Y UW',
  x: 'EH K S',
  y: 'W AY',
  z: 'Z IY'
};

const PHONEME_TOKEN_RE = /^(AA|AE|AH|AO|AW|AY|B|CH|D|DH|EH|ER|EY|F|G|HH|IH|IY|JH|K|L|M|N|NG|OW|OY|P|R|S|SH|T|TH|UH|UW|V|W|Y|Z|ZH)$/;
const WORD_RE = /[a-zA-Z']+|[.,;!?]/g;

function wordToPhonemes(word) {
  const normalized = word.toLowerCase().replace(/^'+|'+$/g, '');
  if (!normalized) return null;
  if (WORD_PHONEMES[normalized]) return WORD_PHONEMES[normalized];

  return normalized
    .split('')
    .map((letter) => LETTER_PHONEMES[letter])
    .filter(Boolean)
    .join(' ');
}

function looksLikeArpabet(input) {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;

  let phonemeCount = 0;
  for (const token of tokens) {
    const bare = token.replace(/[()!]/g, '').replace(/[+-]\d+(?:\.\d+)?$/, '');
    if (PHONEME_TOKEN_RE.test(bare)) phonemeCount += 1;
  }

  return phonemeCount >= Math.max(2, Math.ceil(tokens.length * 0.55));
}

export function textToVoiceChunks(input) {
  const source = typeof input === 'string' ? input.trim() : '';
  if (!source) return [];

  if (looksLikeArpabet(source)) {
    return [{
      id: 'voice-arpabet-0',
      label: source,
      phonemes: source,
      source
    }];
  }

  const matches = source.match(WORD_RE) || [];
  const chunks = [];

  matches.forEach((part) => {
    if (/^[.,;!?]$/.test(part)) return;
    const phonemes = wordToPhonemes(part);
    if (!phonemes) return;

    chunks.push({
      id: `voice-chunk-${chunks.length}`,
      label: part,
      phonemes,
      source: part
    });
  });

  return chunks;
}

function normalizeBuffer(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak <= 0 || peak >= 0.92) return samples;

  const gain = 0.92 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = samples[i] * gain;
  }
  return out;
}

export function renderVoiceChunk(ctx, chunk) {
  const { schedule, totalMs, warnings } = compileString(chunk.phonemes, {
    baseF0: VOICE_BASE_FREQUENCY,
    rate: 112,
    scale: 1.02,
    vibratoDepth: 1.5,
    vibratoRate: 5,
    aspiration: 0.04,
    effort: 0.82
  });

  const samples = normalizeBuffer(renderToBuffer({
    sampleRate: ctx.sampleRate,
    schedule,
    totalMs
  }));

  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);

  return {
    ...chunk,
    buffer,
    duration: buffer.duration,
    warnings
  };
}

export function renderVoicePhrase(ctx, text) {
  const chunks = textToVoiceChunks(text);
  return chunks.map((chunk) => renderVoiceChunk(ctx, chunk));
}

export function renderVoiceScore(ctx, score, options = {}) {
  const { schedule, totalMs, warnings } = compileString(score, {
    baseF0: options.baseF0 ?? VOICE_BASE_FREQUENCY,
    rate: options.rate ?? 120,
    scale: options.scale ?? 1.02,
    vibratoDepth: options.vibratoDepth ?? 1.5,
    vibratoRate: options.vibratoRate ?? 5,
    aspiration: options.aspiration ?? 0.04,
    effort: options.effort ?? 0.82
  });

  const samples = normalizeBuffer(renderToBuffer({
    sampleRate: ctx.sampleRate,
    schedule,
    totalMs
  }));

  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);

  return {
    buffer,
    duration: buffer.duration,
    warnings
  };
}
