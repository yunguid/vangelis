// Voice Loopbook — curated, hand-tuned Klattsch loop scores.
//
// Every score here is verified to compile cleanly against the bundled klattsch
// engine (see voiceLoopbook.test.js) and is designed as a *melody first*: one
// parenthesized group = one sung syllable on one pitch, so the sequence of
// `bNote` directives spells an actual singable line. The goal is a loop you can
// run for minutes — a low bass anchor, a mid-register cruise, a high answering
// lift, and a clean return to the downbeat. Daft Punk's "Harder, Better,
// Faster, Stronger" is the north star: rhythmic consonants articulating a
// hypnotic, emotional vocal arc.
//
// Control overrides are partial — they are merged over the page defaults when a
// loop is loaded, so each entry only names the knobs that give it its voice.

export const LOOPBOOK = [
  {
    id: 'harder-better',
    title: 'Harder Better',
    key: 'F# minor',
    bpm: 127,
    blurb: 'work it · harder · better · faster · stronger',
    notes: 'F# minor i–III–VII climb. Low "work it" pickup arcs up to a bright C#4 answer, then resolves home — the original chant reshaped into a melody.',
    score: `r236 s1.06 g0.8
bF#2 ( W ER K ) bC#3 ( IH T ) bF#3 ( HH AA R ) bA3 ( D ER ) bC#4 ( B EH ) bB3 ( T ER ) bA3 ( F AE S ) bF#3 ( T ER ) bE3 ( S T R AO NG ) bC#3 ( G ER )
bF#3 ( M EY K ) bA3 ( IH T ) bC#4 v4 ( B EH ) bE4 ( T ER ) bD4 ( D UW ) bC#4 ( IH T ) bA3 ( M EY K ) bF#3 ( S AH S )
bF#2 ( M AO R ) bA2 ( DH AH N ) bC#3 ( EH V ) bF#3 ( ER ) bA3 v6 ( AW ER ) bC#4 ( AE F T ) bB3 ( ER R ) bA3 ( AW ER )
bF#3 ( W ER K ) bE3 ( IH Z ) bC#3 ( N EH V ) bA2 ( ER ) bF#2 s1.1 ( OW V ) bF#2 ( ER )`,
    controls: { tone: 4200, wet: 0.18, breath: 0.05, vibratoDepth: 1.6, tremoloDepth: 0.05, tremoloRate: 6, speed: 1 }
  },
  {
    id: 'neon-never-sleeps',
    title: 'Neon Never Sleeps',
    key: 'C# minor',
    bpm: 120,
    blurb: 'neon never sleeps · chasing the skyline',
    notes: 'C# minor cruise. A descending opening hook answered by a slow glowing rise to D#4 — late-night momentum that fades into dawn light.',
    score: `r224 s1.04 g0.78
bC#4 ( N IY ) bB3 ( AA N ) bG#3 ( N EH V ) bE3 ( ER ) bC#3 ( S L IY P S )
bE3 ( CH EY ) bG#3 ( S IH NG ) bB3 ( DH AH ) bC#4 v5 ( S K AY ) bB3 ( L AY N )
bG#3 ( AO L ) bA3 ( N AY T ) bB3 ( L AO NG ) bC#4 ( W IY ) bD#4 ( G L OW )
bC#4 ( F EY ) bB3 ( D IH NG ) bG#3 ( IH N T UW ) bE3 ( D AO N ) bC#3 s1.1 ( L AY T )`,
    controls: { tone: 3900, wet: 0.22, breath: 0.06, vibratoDepth: 1.8, tremoloDepth: 0.04, tremoloRate: 5, speed: 1 }
  },
  {
    id: 'glass-cathedral',
    title: 'Glass Cathedral',
    key: 'A minor',
    bpm: 116,
    blurb: 'glass cathedral · rising in silence',
    notes: 'A minor opening into a lydian F4 lift. Wide, resolved leaps and held shimmer — a slow, reverent ascent that returns to a low hum.',
    score: `r248 s1.05 g0.76 v2
bA2 ( G L AE S ) bE3 ( K AH ) bA3 ( TH IY ) bC4 ( D R AH L ) bB3 ( OW )
bA3 ( L AY ) bC4 ( T IH NG ) bE4 v6 ( AH P ) bD4 ( DH AH ) bC4 ( N EY V )
bG3 ( W IY ) bA3 ( R AY Z ) bC4 ( IH N ) bF4 ( S AY ) bE4 ( L EH N S )
bC4 ( HH OW ) bB3 ( L D IH NG ) bA3 ( S T IH L ) bE3 ( N EH S ) bA2 s1.12 ( OW M )`,
    controls: { tone: 4600, wet: 0.28, breath: 0.07, vibratoDepth: 2.2, tremoloDepth: 0.03, tremoloRate: 5, speed: 1 }
  },
  {
    id: 'mercury-rain',
    title: 'Mercury Rain',
    key: 'F minor',
    bpm: 122,
    blurb: 'mercury rain · falling slowly',
    notes: 'F minor falling staircase. A low bass anchor drops, then a liquid descending sequence pours down from the ceiling — melancholy, smooth, hypnotic.',
    score: `r210 s1.03 g0.8
bF2 ( M ER ) bAb2 ( K Y ER ) bDb4 ( IY ) bC4 ( R EY N )
bBb3 ( F AO ) bAb3 ( L IH NG ) bF3 ( S L OW ) bEb3 ( L IY )
bF2 ( S IH L ) bAb2 ( V ER ) bDb4 v5 ( S T R IY M Z ) bC4 ( DH R UW )
bBb3 ( DH AH ) bAb3 ( D AA R K ) bF3 ( N EH S ) bF2 s1.1 ( OW M )`,
    controls: { tone: 4000, wet: 0.24, breath: 0.06, vibratoDepth: 1.6, tremoloDepth: 0.06, tremoloRate: 7, speed: 1 }
  },
  {
    id: 'ghost-machine',
    title: 'Ghost In The Machine',
    key: 'E minor',
    bpm: 130,
    blurb: 'ghost in the machine · one and zero',
    notes: 'E minor robotic chant. Repeated-note groove on the low end with a melodic answer reaching up to D4 — driving and uncanny.',
    score: `r198 s1.02 g0.82
bE3 ( G OW S T ) bE3 ( IH N ) bG3 ( DH AH ) bB3 ( M AH ) bA3 ( SH IY N )
bB3 ( IY ) bC4 ( EH M ) bB3 ( AH ) bA3 ( L AY V ) bG3 ( N AW )
bE3 ( W AH N ) bG3 ( AE N D ) bA3 ( Z IH ) bB3 ( R OW ) bD4 v6 ( W AH N )
bB3 ( EH ) bA3 ( K OW ) bG3 ( IH N ) bE3 ( DH AH ) bE2 s1.1 ( W AY R )`,
    controls: { tone: 4400, wet: 0.16, breath: 0.04, vibratoDepth: 1.2, tremoloDepth: 0.07, tremoloRate: 8, speed: 1 }
  },
  {
    id: 'velvet-circuitry',
    title: 'Velvet Circuitry',
    key: 'G# minor',
    bpm: 112,
    blurb: 'velvet circuitry · pulsing soft and warm',
    notes: 'G# minor lounge arpeggio. A smooth rising figure that glimmers at the top and settles into a warm beating heart — slow and sensual.',
    score: `r256 s1.05 g0.74 v3
bG#2 ( V EH L ) bD#3 ( V EH T ) bG#3 ( S ER ) bB3 ( K IH T ) bC#4 ( R IY )
bD#4 v6 ( G L IY ) bC#4 ( M IH NG ) bB3 ( S OW F T ) bG#3 ( L IY )
bF#3 ( W AA R M ) bG#3 ( EH L ) bB3 ( EH K ) bC#4 ( T R IH K )
bB3 ( P AH L ) bA3 ( S IH NG ) bF#3 ( S L OW ) bD#3 s1.12 ( HH AA R T )`,
    controls: { tone: 3700, wet: 0.26, breath: 0.07, vibratoDepth: 2.4, tremoloDepth: 0.05, tremoloRate: 5, speed: 1 }
  },
  {
    id: 'aurora-protocol',
    title: 'Aurora Protocol',
    key: 'D dorian',
    bpm: 124,
    blurb: 'aurora breaks · we are the signal',
    notes: 'D dorian sunrise. A bright rising sequence that crests on E4 and echoes home — hopeful, electric, anthemic.',
    score: `r214 s1.03 g0.8
bD3 ( AO ) bF3 ( R AO ) bA3 ( R AH ) bC4 ( B R EY K S )
bD4 v5 ( DH AH ) bC4 ( D AO N ) bA3 ( P R OW ) bG3 ( T AH ) bF3 ( K AO L )
bA3 ( W IY ) bC4 ( AA R ) bD4 ( DH AH ) bE4 ( S IH G ) bD4 ( N AH L )
bC4 ( EH ) bA3 ( K OW ) bF3 ( IH NG ) bD3 s1.1 ( HH OW M )`,
    controls: { tone: 4800, wet: 0.20, breath: 0.05, vibratoDepth: 1.8, tremoloDepth: 0.04, tremoloRate: 6, speed: 1 }
  },
  {
    id: 'midnight-engine',
    title: 'Midnight Engine',
    key: 'B minor',
    bpm: 132,
    blurb: 'midnight engine · humming low · riding the night',
    notes: 'B minor pulsing groove. A throbbing bass octave anchors a melody that climbs into morning light — propulsive and cinematic.',
    score: `r188 s1.02 g0.84
bB2 ( M IH D ) bB2 ( N AY T ) bF#3 ( EH N ) bD3 ( JH IH N )
bB3 ( HH AH ) bA3 ( M IH NG ) bF#3 ( L OW ) bD3 ( IH N )
bB2 ( W IY ) bF#3 ( R AY D ) bA3 ( DH AH ) bD4 v6 ( N AY T )
bC#4 ( IH N ) bB3 ( T UW ) bA3 ( M AO R ) bF#3 ( N IH NG ) bB2 s1.1 ( L AY T )`,
    controls: { tone: 4300, wet: 0.18, breath: 0.04, vibratoDepth: 1.4, tremoloDepth: 0.06, tremoloRate: 7, speed: 1 }
  },
  {
    id: 'crystal-equinox',
    title: 'Crystal Equinox',
    key: 'A# minor',
    bpm: 118,
    blurb: 'crystal equinox · balance in dim light',
    notes: 'A# minor call-and-response. A shimmering question rises and is answered up high, then folds gently home — glassy and weightless.',
    score: `r230 s1.05 g0.78 v3
bA#2 ( K R IH S ) bF3 ( T AH L ) bA#3 ( EH ) bC#4 ( K W IH ) bD#4 ( N AA K S )
bC#4 ( B AH ) bA#3 ( L AE N S ) bF#3 ( D IH N ) bF3 ( L AY T )
bA#3 ( W IY ) bC#4 ( SH IH ) bD#4 v6 ( M ER ) bF4 ( IH N ) bD#4 ( D AA R K )
bC#4 ( F OW ) bA#3 ( L D IH NG ) bF3 ( HH OW M ) bA#2 s1.12 ( AA )`,
    controls: { tone: 4700, wet: 0.27, breath: 0.07, vibratoDepth: 2.3, tremoloDepth: 0.03, tremoloRate: 5, speed: 1 }
  },
  {
    id: 'solar-static',
    title: 'Solar Static',
    key: 'D# minor',
    bpm: 130,
    blurb: 'solar static · burning bright · into the sunlight',
    notes: 'D# minor driving pulse. A repeated-note bass groove ignites and lifts to a blazing high F4 before settling — propulsive and radiant.',
    score: `r196 s1.02 g0.84
bD#3 ( S OW ) bD#3 ( L ER ) bF#3 ( S T AE ) bA#3 ( T IH K )
bC#4 ( HH AH ) bA#3 ( M IH NG ) bF#3 ( L OW ) bD#3 ( IH N )
bD#3 ( W IY ) bA#3 ( B ER N ) bC#4 ( B R AY T ) bF4 v6 ( ER )
bD#4 ( IH N ) bC#4 ( T UW ) bA#3 ( DH AH ) bF#3 ( S AH N ) bD#3 s1.1 ( L AY T )`,
    controls: { tone: 4500, wet: 0.19, breath: 0.04, vibratoDepth: 1.5, tremoloDepth: 0.06, tremoloRate: 7, speed: 1 }
  }
];

export const STARTER_LOOP = LOOPBOOK[0];

export function getLoopById(id) {
  return LOOPBOOK.find((loop) => loop.id === id) || null;
}
