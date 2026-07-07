/**
 * Display-name codes for the "Originals" MIDI corpus.
 *
 * Single source of truth for the 58 originals' display names. Both
 * `src/utils/midiParser.js` (the in-app MIDI browser) and
 * `scripts/generate_original_midis.mjs` (the corpus generator, which embeds
 * the name into each .mid file's header) import `ORIGINAL_CUE_NAMES` from
 * here instead of hand-writing a name string — this is the fix for the
 * two-copies-of-the-same-name drift hazard recorded in INTERFACE_LEDGER.md.
 *
 * IDs and .mid file paths are untouched by this module; it only maps the
 * existing stable `id` string to a new display name. The mapping below is
 * a plain committed object (not computed at import time) so it never
 * silently changes if the wordlists are edited later — to regenerate it,
 * call `buildOriginalCueNameMap(ORIGINAL_CUE_IDS)` (e.g. from a one-off
 * `node -e` snippet importing this module) and paste the result back in
 * here; a test in `src/utils/midiParser.test.js` pins that the committed
 * map matches what the generator function currently produces.
 *
 * ## Naming scheme
 *
 * Names are machine-adjacent, lowercase-leaning, dry little codes — no epic
 * words, no poetry, no parentheses. Each name is deterministically derived
 * from the song's stable `id` string via an FNV-1a hash feeding a small
 * seeded PRNG (mulberry32) — NOT Math.random, NOT Date — so regenerating
 * the corpus always reproduces the same names. Four formats are mixed:
 *
 *   0. consonant-pair + number   -> "bx-41"
 *   1. odd-noun + underscore + number -> "moth_22"
 *   2. ALLCAPS word + digit      -> "DIAL 9"
 *   3. time/unit compound        -> "4AM UNIT"
 *
 * (format 4, odd-noun + zero-padded dash number, e.g. "pelican-00", is also
 * available and used by the generator's format roll.)
 *
 * The seed is rolled forward deterministically (id + "#1", id + "#2", ...)
 * whenever a candidate name collides with an already-assigned one, or would
 * reuse any word stem more than WORD_STEM_CAP (2) times across the whole
 * map — repeated odd words are what betray a small-wordlist PRNG.
 */

/** 32-bit FNV-1a hash of a string. */
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, deterministic PRNG seeded from a 32-bit int. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Curated wordlist: odd, flat, non-poetic nouns — animals, objects,
// telecom/tape/utility words. Deliberately dull. Sized so the per-stem
// usage cap (WORD_STEM_CAP below) converges without long re-roll chains
// across 58 names.
const ODD_NOUNS = [
  'moth', 'pelican', 'krill', 'dial', 'tape', 'socket', 'ferry', 'gravel',
  'modem', 'gull', 'ash', 'crate', 'valve', 'plank', 'grate', 'husk',
  'wick', 'flint', 'reel', 'drum', 'clamp', 'rivet', 'silo', 'pallet',
  'ember', 'grub', 'newt', 'stoat', 'heron', 'vole', 'shale', 'brick',
  'gasket', 'mullet', 'ledger', 'carp', 'sprocket', 'foyer', 'mop',
  'antenna', 'lint', 'hinge', 'turnip', 'spigot', 'awning', 'gutter',
  'bollard', 'tarp', 'winch', 'flange', 'grommet', 'eel', 'pigeon'
];

const CONSONANT_PAIRS = [
  'bx', 'zq', 'kr', 'vt', 'dn', 'gx', 'mq', 'tz', 'wr', 'fk',
  'jx', 'pl', 'sv', 'nx', 'qb', 'rk', 'zt', 'hv', 'cx', 'dg'
];

const ALLCAPS_WORDS = [
  'DIAL', 'TAPE', 'UNIT', 'FERRY', 'SOCKET', 'GRATE', 'VALVE', 'CRATE',
  'SILO', 'RIVET', 'PLANK', 'HUSK', 'DRUM', 'CLAMP', 'ASH', 'GRUB',
  'GASKET', 'LEDGER', 'HINGE', 'SPROCKET', 'ANTENNA', 'LINT', 'TARP',
  'WINCH'
];

// Real words or real clock times only — no truncations ("MIDN" reads as
// a bug, not a joke).
const TIME_PREFIXES = ['4AM', '3AM', '2AM', '5AM', '6AM', 'NOON', 'DUSK', 'DAWN', 'ZERO'];
const UNIT_WORDS = ['UNIT', 'ZONE', 'CELL', 'RIG', 'DOCK', 'BAY', 'YARD', 'DUCT'];

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Render one candidate name for a given format index (0-4) using `rng`. */
function renderFormat(rng, format) {
  switch (format) {
    case 0: { // consonant-pair + number: bx-41
      const pair = pick(rng, CONSONANT_PAIRS);
      const num = Math.floor(rng() * 90) + 10; // 10-99
      return `${pair}-${num}`;
    }
    case 1: { // odd-noun + underscore + number: moth_22
      const noun = pick(rng, ODD_NOUNS);
      const num = Math.floor(rng() * 90) + 10;
      return `${noun}_${num}`;
    }
    case 2: { // ALLCAPS word + digit: DIAL 9
      const word = pick(rng, ALLCAPS_WORDS);
      const num = Math.floor(rng() * 10);
      return `${word} ${num}`;
    }
    case 3: { // time/unit compound: 4AM UNIT
      const time = pick(rng, TIME_PREFIXES);
      const unit = pick(rng, UNIT_WORDS);
      return `${time} ${unit}`;
    }
    case 4: { // odd-noun + dash + zero-padded number: pelican-00
      const noun = pick(rng, ODD_NOUNS);
      const num = Math.floor(rng() * 100);
      return `${noun}-${String(num).padStart(2, '0')}`;
    }
    default:
      return 'bx-00';
  }
}

const FORMAT_COUNT = 5;

/**
 * Deterministically derive a single code name for a stable id string.
 * `attempt` bumps the seed on collision (id, then "id#1", "id#2", ...).
 * @param {string} id - Stable song id (e.g. 'original-neon-rain').
 * @param {number} [attempt] - Collision-retry counter, starts at 0.
 * @returns {string} A code name, e.g. 'bx-41', 'moth_22', 'DIAL 9'.
 */
export function generateCodeName(id, attempt = 0) {
  const seedInput = attempt === 0 ? id : `${id}#${attempt}`;
  const rng = mulberry32(fnv1a(seedInput));
  const format = Math.floor(rng() * FORMAT_COUNT);
  return renderFormat(rng, format);
}

/**
 * Max times any word stem (the non-numeric part of a name: "krill",
 * "husk", "unit", "kr", "4am"...) may appear across the whole map. A human
 * naming files weirdly doesn't reuse the same odd word four times; a
 * small-wordlist PRNG does — this cap keeps the output from betraying the
 * generator.
 */
export const WORD_STEM_CAP = 2;

/**
 * Extract the word stems of a code name, lowercased, numbers dropped.
 * "krill_51" -> ["krill"]; "4AM UNIT" -> ["4am", "unit"]; "bx-41" -> ["bx"].
 * @param {string} name
 * @returns {string[]}
 */
export function wordStemsOf(name) {
  return name
    .toLowerCase()
    .split(/[-_ ]+/)
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
}

/**
 * Build the full id -> codeName map for an ordered list of stable ids,
 * re-rolling deterministically (id#1, id#2, ...) whenever a candidate
 * collides with an already-assigned name OR would push any of its word
 * stems past WORD_STEM_CAP uses — so every name is unique and no stem
 * repeats often enough to look machine-generated.
 * @param {string[]} ids - Stable song ids, in any fixed order.
 * @returns {Record<string, string>} id -> unique code name.
 */
export function buildOriginalCueNameMap(ids) {
  const used = new Set();
  const stemCounts = new Map();
  const map = {};
  const overCap = (name) => wordStemsOf(name)
    .some((stem) => (stemCounts.get(stem) || 0) >= WORD_STEM_CAP);
  for (const id of ids) {
    let attempt = 0;
    let name = generateCodeName(id, attempt);
    while (used.has(name) || overCap(name)) {
      attempt += 1;
      name = generateCodeName(id, attempt);
    }
    used.add(name);
    for (const stem of wordStemsOf(name)) {
      stemCounts.set(stem, (stemCounts.get(stem) || 0) + 1);
    }
    map[id] = name;
  }
  return map;
}

/**
 * Ordered list of the 58 originals' stable ids (order is cosmetic/for
 * provenance only — `midiParser.js` is the source of truth for id order
 * and .mid paths; this list must stay in sync with it by id set, not order).
 */
export const ORIGINAL_CUE_IDS = [
  'original-neon-rain',
  'original-elegy-for-replicants',
  'original-sea-of-dunes',
  'original-escape-velocity',
  'original-green-memories',
  'original-rain-on-chrome',
  'original-offworld-anthem',
  'original-vapor-lights',
  'original-scream-at-the-sky',
  'original-chrome-canyon-run',
  'original-sugar-crash-angel',
  'original-red-mist',
  'original-analog-sunrise',
  'original-velvet-horizon',
  'original-strings-of-io',
  'original-west-coast-wall',
  'original-ghost-frequency',
  'original-airborne-cathedral',
  'original-night-drive-basement',
  'original-trap-door',
  'original-concrete-teeth',
  'original-acid-perimeter',
  'original-low-tide-fog',
  'original-glass-elevator',
  'original-bells-for-rachael',
  'original-pixel-heartbreak',
  'original-2am-lullaby',
  'original-chime-orbit',
  'original-alarm-district',
  'original-shimmer-bloom',
  'original-ribbon-in-the-rain',
  'original-gulls-over-voltage-bay',
  'original-cathedral-of-wires',
  'original-neon-cathedral',
  'original-static-bloom',
  'original-glitter-riot',
  'original-halogen-heart',
  'original-midnight-slide',
  'original-black-ice',
  'original-adrenaline-red',
  'original-teeth-grinder',
  'original-first-light-over-la',
  'original-solar-sail',
  'original-rust-and-chrome',
  'original-violet-skyline',
  'original-magnetic-north',
  'original-deep-signal',
  'original-afterimage',
  'original-late-checkout',
  'original-thunder-veil',
  'original-warm-static',
  'original-zero-gravity-waltz',
  'original-tokyo-monorail',
  'original-perimeter-run',
  'original-glass-garden',
  'original-copper-wires',
  'original-dust-devils',
  'original-crystal-run'
];

/**
 * Committed id -> codeName mapping. This is the actual output of
 * `buildOriginalCueNameMap(ORIGINAL_CUE_IDS)` at the time the scheme was
 * authored, pinned as a literal object so the display names never drift if
 * the generator's wordlists change later. Both consumers read this object.
 */
export const ORIGINAL_CUE_NAMES = {
  'original-neon-rain': 'dial_51',
  'original-elegy-for-replicants': '3AM ZONE',
  'original-sea-of-dunes': 'GASKET 5',
  'original-escape-velocity': 'hv-57',
  'original-green-memories': '6AM RIG',
  'original-rain-on-chrome': 'pallet-65',
  'original-offworld-anthem': 'clamp_27',
  'original-vapor-lights': 'LEDGER 9',
  'original-scream-at-the-sky': 'lint_46',
  'original-chrome-canyon-run': 'kr-53',
  'original-sugar-crash-angel': 'ferry-67',
  'original-red-mist': 'pallet-24',
  'original-analog-sunrise': 'DUSK DUCT',
  'original-velvet-horizon': 'eel_71',
  'original-strings-of-io': 'TAPE 8',
  'original-west-coast-wall': 'gull-47',
  'original-ghost-frequency': 'LINT 3',
  'original-airborne-cathedral': '5AM DOCK',
  'original-night-drive-basement': 'dial_26',
  'original-trap-door': 'grate-57',
  'original-concrete-teeth': 'grommet-64',
  'original-acid-perimeter': 'spigot_21',
  'original-low-tide-fog': 'winch_96',
  'original-glass-elevator': 'tape-64',
  'original-bells-for-rachael': '4AM CELL',
  'original-pixel-heartbreak': 'mq-65',
  'original-2am-lullaby': '4AM UNIT',
  'original-chime-orbit': 'SOCKET 5',
  'original-alarm-district': 'kr-32',
  'original-shimmer-bloom': 'gx-40',
  'original-ribbon-in-the-rain': 'CRATE 5',
  'original-gulls-over-voltage-bay': 'GRUB 3',
  'original-cathedral-of-wires': 'zq-92',
  'original-neon-cathedral': 'silo-54',
  'original-static-bloom': '3AM CELL',
  'original-glitter-riot': 'pigeon_57',
  'original-halogen-heart': 'bx-97',
  'original-midnight-slide': 'DAWN DUCT',
  'original-black-ice': 'eel_59',
  'original-adrenaline-red': 'VALVE 5',
  'original-teeth-grinder': 'sv-33',
  'original-first-light-over-la': 'ANTENNA 4',
  'original-solar-sail': 'valve_28',
  'original-rust-and-chrome': 'krill_57',
  'original-violet-skyline': 'mullet-61',
  'original-magnetic-north': 'carp_19',
  'original-deep-signal': 'DUSK RIG',
  'original-afterimage': 'dg-27',
  'original-late-checkout': 'gasket_84',
  'original-thunder-veil': 'NOON UNIT',
  'original-warm-static': 'hinge-57',
  'original-zero-gravity-waltz': 'FERRY 0',
  'original-tokyo-monorail': 'crate_28',
  'original-perimeter-run': 'CLAMP 9',
  'original-glass-garden': 'DAWN BAY',
  'original-copper-wires': 'wr-13',
  'original-dust-devils': 'pl-28',
  'original-crystal-run': 'LEDGER 1'
};

/**
 * Get the display code name for an original cue's stable id, falling back
 * to the id itself (never undefined) if the map is somehow missing an
 * entry — keeps rendering safe even if this module and the id list drift.
 * @param {string} id
 * @returns {string}
 */
export function getOriginalCueName(id) {
  return ORIGINAL_CUE_NAMES[id] || id;
}
