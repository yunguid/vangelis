const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.5';

const VOICE_WORDS = [
  'i', 'we', 'you', 'are', 'am', 'be', 'can', 'do', 'make', 'move', 'go',
  'again', 'alive', 'bright', 'burn', 'dark', 'digital', 'dream', 'electric',
  'faster', 'friend', 'from', 'ghost', 'hard', 'harder', 'hello', 'in', 'it',
  'light', 'love', 'me', 'moon', 'more', 'motion', 'morning', 'music', 'my',
  'never', 'night', 'of', 'on', 'over', 'rain', 'remember', 'robot', 'say',
  'speak', 'star', 'stronger', 'the', 'this', 'through', 'time', 'tonight',
  'to', 'voice', 'wake', 'with', 'work', 'world'
];

const FALLBACK_PHRASES = [
  'we wake in electric morning and move through bright motion again tonight',
  'i remember the robot voice in the dark light moving faster over the moon',
  'you make the music work harder and we burn bright through digital rain',
  'we are alive in the night and the voice can move more with motion',
  'hello friend we speak through electric time and make the world remember'
];

const PHRASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['phrase'],
  properties: {
    phrase: {
      type: 'string',
      description: 'Lowercase space-separated words for a robotic vocal pattern.'
    }
  }
};

const VOICE_PHRASE_SYSTEM_PROMPT = [
  'You write original phrase text for a browser synthesizer that turns words into robotic chopped vocal patterns.',
  'The phrase is not prose and not lyrics from any existing song. It is source material for vocoder-like rhythm.',
  'Make one long, unique, rhythmically useful phrase: 16 to 28 words.',
  'Use lowercase words separated by spaces. No punctuation, no line breaks, no proper nouns, no quotes.',
  'Favor hard consonants, open vowels, repetition, internal rhythm, and words that sound good when chopped into fast sixteenth-note patterns.',
  'Avoid direct imitation of any artist, song, lyric, brand, or famous phrase.',
  `Use only these words so the local speech renderer can pronounce them: ${VOICE_WORDS.join(', ')}.`,
  'Return only the structured phrase.'
].join('\n');

function fallbackPhrase() {
  const base = FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)];
  const tail = [
    'again',
    'tonight',
    'more',
    'motion',
    'bright',
    'voice'
  ].sort(() => Math.random() - 0.5).slice(0, 4).join(' ');
  return `${base} ${tail}`;
}

function normalizePhrase(value) {
  if (typeof value !== 'string') return fallbackPhrase();

  const words = value
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ''))
    .filter((word) => VOICE_WORDS.includes(word));

  if (words.length < 10) return fallbackPhrase();
  return words.slice(0, 32).join(' ');
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

async function generateVoicePhrase(request = {}, env = process.env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MUSIC_MODEL || DEFAULT_MODEL;
  const currentText = typeof request.currentText === 'string'
    ? request.currentText.trim().slice(0, 220)
    : '';

  if (!apiKey) {
    return {
      source: 'fallback',
      model: null,
      warning: 'OPENAI_API_KEY is not configured for this server.',
      phrase: fallbackPhrase()
    };
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
      prompt_cache_key: 'vangelis-voice-phrase-v1',
      max_output_tokens: 520,
      instructions: VOICE_PHRASE_SYSTEM_PROMPT,
      input: JSON.stringify({
        currentText,
        request: 'create a fresh phrase that is different from currentText'
      }),
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'vangelis_voice_phrase',
          strict: true,
          schema: PHRASE_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    return {
      source: 'fallback',
      model,
      warning: `OpenAI request failed with ${response.status}.`,
      phrase: fallbackPhrase()
    };
  }

  const responseJson = await response.json();
  if (responseJson.status && responseJson.status !== 'completed') {
    return {
      source: 'fallback',
      model,
      warning: `OpenAI response ended as ${responseJson.status}.`,
      phrase: fallbackPhrase()
    };
  }

  const outputText = collectOutputText(responseJson);
  try {
    const parsed = JSON.parse(outputText);
    return {
      source: 'openai',
      model,
      warning: '',
      phrase: normalizePhrase(parsed.phrase)
    };
  } catch (_) {
    return {
      source: 'fallback',
      model,
      warning: 'OpenAI response was not parseable phrase JSON.',
      phrase: fallbackPhrase()
    };
  }
}

module.exports = {
  VOICE_PHRASE_SYSTEM_PROMPT,
  fallbackPhrase,
  generateVoicePhrase
};
