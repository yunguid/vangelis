import React from 'react';
import GrandStaff from '../components/learn/GrandStaff.jsx';
import LearnKeyboard from '../components/learn/LearnKeyboard.jsx';
import { LEARN_PIECES, getLearnPiece, getLearnPieceForPieceId, loadLesson } from '../data/learnPieces.js';
import { loadLastLandingId } from '../data/landingQueue.js';
import { useAudioEngineWarmup } from '../hooks/useAudioEngineWarmup.js';
import { useMidiListener } from '../hooks/useMidiListener.js';
import { useMidiPlayback } from '../hooks/useMidiPlayback.js';
import { audioEngine } from '../utils/audioEngine.js';
import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { keySignatureLetters, spellMidi } from '../utils/learn/lesson.js';
import { practiceAccuracy, practiceSteps, startPractice, strikeKey } from '../utils/learn/practice.js';
import { loadProgress, phraseStanding, recordRun } from '../utils/learn/progress.js';
import { midiNoteToFrequency } from '../utils/math.js';
import { HOME_HREF, getLearnHref } from '../utils/routes.js';
import './LearnPage.css';

/**
 * Learn a landing piece at the piano: its phrases one at a time on a grand staff, played by
 * ear (Listen), then by hand in wait mode (Practice) from the learner's own keyboard over Web
 * MIDI or from the keys on screen; the chords it is built from; and how to read the staff.
 */

const HANDS = [
  { id: 'left', label: 'Left hand' },
  { id: 'both', label: 'Both' },
  { id: 'right', label: 'Right hand' }
];
// How much help the staff and keys give: names and keys, keys only, or the staff alone.
const GUIDES = [
  { id: 'names', label: 'Names', hint: 'Note names on the staff and keys' },
  { id: 'keys', label: 'Keys', hint: 'Keys marked, names hidden' },
  { id: 'staff', label: 'Read', hint: 'Read the staff — nothing marked' }
];
const LAST_PHRASE_KEY = 'vangelis.learnLastPhrase.v1';
const SLOW = 0.6;
const DEFAULT_PIANO = sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, volume: 0.8, attack: 0.004, decay: 1.4, sustain: 0.35, release: 0.9 });

const readLastPhrase = (slug) => {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_PHRASE_KEY));
    return Number.isInteger(stored?.[slug]) ? stored[slug] : 0;
  } catch {
    return 0;
  }
};
const writeLastPhrase = (slug, index) => {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_PHRASE_KEY)) || {};
    localStorage.setItem(LAST_PHRASE_KEY, JSON.stringify({ ...stored, [slug]: index }));
  } catch {
    // Without storage the page opens on the first phrase.
  }
};

const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const noteNames = (notes, fifths) => notes.map((note) => spellMidi(note.midi, fifths).label);

const keySignatureText = (key) => {
  if (!key) return '';
  const letters = keySignatureLetters(key.fifths).map((letter) => 'CDEFGAB'[letter]);
  if (letters.length === 0) return 'No sharps or flats: every note is a white key unless a sign beside it says otherwise.';
  const sharp = key.fifths > 0;
  const count = `${letters.length} ${sharp ? 'sharp' : 'flat'}${letters.length > 1 ? 's' : ''}`;
  return `${count} at the start of each line: every ${letters.join(', ')} is played ${sharp ? 'sharp — the black key just above' : 'flat — the black key just below'}, in every octave, unless a ♮ says otherwise.`;
};

/** A phrase's melody as a tiny line: the top note of each step, for the phrase map. */
const contourPoints = (phrase, width = 56, height = 18) => {
  const tops = phrase.steps.map((step) => step.notes[step.notes.length - 1].midi);
  const lo = Math.min(...tops);
  const hi = Math.max(...tops);
  const span = Math.max(1, phrase.end - phrase.start);
  return phrase.steps.map((step, i) => {
    const x = ((step.time - phrase.start) / span) * width;
    const y = height - ((tops[i] - lo) / Math.max(1, hi - lo)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

/** Text with its ♯ and ♭ set tight (the serif's own have wide shoulders, or none at all). */
const Music = ({ children }) => String(children).split(/([♯♭])/).map((part, i) => (
  part === '♯' || part === '♭' ? <span key={i} className="learn-accidental">{part}</span> : part
));

/** A chord in root position, low on the keyboard (from the C below middle C). */
const rootPosition = (chord) => {
  const root = 48 + chord.root;
  return chord.tones.map((pc) => root + ((pc - chord.root + 12) % 12));
};

const MidiStatus = ({ status, deviceName }) => {
  const text = {
    connected: deviceName,
    none: 'Plug your piano in over USB to play along',
    waiting: 'Looking for your piano…',
    denied: 'MIDI was blocked — allow it from the address bar',
    unsupported: 'Open in Chrome or Edge to play along from your piano'
  }[status];
  return (
    <p className={`learn-midi learn-midi--${status}`} aria-live="polite">
      <span className="learn-midi__dot" aria-hidden="true" />
      <span>{status === 'connected' ? <>Listening to <strong>{text}</strong></> : text}</span>
    </p>
  );
};

const useStaffWidth = () => {
  const ref = React.useRef(null);
  const [width, setWidth] = React.useState(880);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

const LearnPage = ({ slug }) => {
  // A bare #/learn opens the piece the home page played last.
  const piece = getLearnPiece(slug) || getLearnPieceForPieceId(loadLastLandingId()) || LEARN_PIECES[0];
  useAudioEngineWarmup();

  const [lesson, setLesson] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [phraseIndex, setPhraseIndex] = React.useState(() => readLastPhrase(piece.slug));
  const [hands, setHands] = React.useState('right');
  const [guide, setGuide] = React.useState('names');
  const [anyOctave, setAnyOctave] = React.useState(false);
  const [slow, setSlow] = React.useState(true);
  const [practice, setPractice] = React.useState(null);
  const [held, setHeld] = React.useState(() => new Set());
  const [progress, setProgress] = React.useState(() => loadProgress(piece.slug));
  const [pianoParams, setPianoParams] = React.useState(DEFAULT_PIANO);
  const [playhead, setPlayhead] = React.useState(null);
  const [staffRef, staffWidth] = useStaffWidth();
  const playback = useMidiPlayback({ waveformType: 'Sine', audioParams: pianoParams });

  React.useEffect(() => {
    let current = true;
    setLesson(null);
    setError(null);
    setPractice(null);
    setProgress(loadProgress(piece.slug));
    setPhraseIndex(readLastPhrase(piece.slug));
    loadLesson(piece)
      .then((loaded) => {
        if (current) setLesson(loaded);
      })
      .catch((cause) => {
        if (current) setError(cause);
      });
    return () => {
      current = false;
    };
  }, [piece]);

  // The page plays (and the keys on screen sound) as the recorded grand piano.
  React.useEffect(() => {
    let current = true;
    (async () => {
      try {
        await audioEngine.ensureAudioContext();
        const { loadSampledInstrument, findSampledInstrument } = await import('../data/sampledInstruments.js');
        const grand = findSampledInstrument('opening-piano');
        const params = sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...grand.audioParams, volume: 0.82 });
        if (!current) return;
        setPianoParams(params);
        audioEngine.setSanitizedGlobalParams(params);
        const loaded = await loadSampledInstrument(audioEngine.context, 'opening-piano');
        if (current) await audioEngine.setInstrument(loaded);
      } catch (cause) {
        console.warn('Learn: the piano recordings could not be loaded; the synth plays instead.', cause);
      }
    })();
    return () => {
      current = false;
      audioEngine.setInstrument(null);
    };
  }, []);

  React.useEffect(() => {
    audioEngine.setSanitizedGlobalParams(pianoParams);
  }, [pianoParams]);

  const phrases = lesson?.phrases || [];
  const index = Math.min(phraseIndex, Math.max(0, phrases.length - 1));
  const phrase = phrases[index] || null;
  const fifths = phrase?.key.fifths ?? 0;
  const steps = React.useMemo(() => practiceSteps(phrase, hands), [phrase, hands]);
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;

  const stopAll = React.useCallback(() => {
    playback.stop();
    setPlayhead(null);
    setPractice(null);
  }, [playback.stop]);

  React.useEffect(() => {
    stopAll();
    if (lesson) writeLastPhrase(piece.slug, index);
  }, [index, hands, lesson, piece.slug, stopAll]);

  React.useEffect(() => () => playback.stop(), [playback.stop]);

  // A finished run is remembered for the phrase map.
  React.useEffect(() => {
    if (!practice?.done) return;
    setProgress(recordRun(piece.slug, index, hands, practiceAccuracy(practice)));
  }, [practice?.done]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playing ──────────────────────────────────────────────────────────

  const handleNoteOn = React.useCallback((midi) => {
    setHeld((previous) => new Set(previous).add(midi));
    if (playback.isPlaying) return;
    // Practice starts with the first right note, or when Practice is pressed.
    setPractice((state) => {
      const first = stepsRef.current[0];
      if (!state && !first?.notes.some((note) => (anyOctave ? (note.midi - midi) % 12 === 0 : note.midi === midi))) return state;
      return strikeKey(state || startPractice(), stepsRef.current, midi, { anyOctave, now: performance.now() });
    });
  }, [anyOctave, playback.isPlaying]);

  const handleNoteOff = React.useCallback((midi) => {
    setHeld((previous) => {
      if (!previous.has(midi)) return previous;
      const next = new Set(previous);
      next.delete(midi);
      return next;
    });
  }, []);

  const midiInput = useMidiListener({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

  const pressScreenKey = React.useCallback((midi) => {
    audioEngine.playFrequency({ noteId: `learn-${midi}`, frequency: midiNoteToFrequency(midi), params: pianoParams, velocity: 0.72 });
    handleNoteOn(midi);
  }, [handleNoteOn, pianoParams]);
  const releaseScreenKey = React.useCallback((midi) => {
    audioEngine.stopNote(`learn-${midi}`);
    handleNoteOff(midi);
  }, [handleNoteOff]);

  const listen = React.useCallback(() => {
    if (!phrase) return;
    if (playback.isPlaying) {
      stopAll();
      return;
    }
    setPractice(null);
    const notes = phrase.steps
      .flatMap((step) => step.notes)
      .filter((note) => hands === 'both' || note.hand === hands)
      .map((note) => ({ midi: note.midi, time: note.time - phrase.start, duration: Math.min(note.duration, phrase.end - note.time + 1.5), velocity: note.velocity ?? 0.7 }));
    playback.setTempo(slow ? SLOW : 1);
    playback.play({ notes, duration: phrase.end - phrase.start + 0.6 });
  }, [phrase, hands, slow, playback.isPlaying, playback.play, playback.setTempo, stopAll]);

  // The playhead follows the audio clock while a phrase plays.
  React.useEffect(() => {
    if (!playback.isPlaying || !phrase) {
      setPlayhead(null);
      return undefined;
    }
    let frame = 0;
    const duration = phrase.end - phrase.start + 0.6;
    const tick = () => {
      setPlayhead(phrase.start + playback.getPlaybackProgress() * duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback.isPlaying, playback.getPlaybackProgress, phrase]);

  const begin = React.useCallback(() => {
    playback.stop();
    setPractice(startPractice());
  }, [playback.stop]);

  const goTo = React.useCallback((next) => {
    setPhraseIndex(Math.max(0, Math.min(phrases.length - 1, next)));
  }, [phrases.length]);

  const standRef = React.useRef(null);
  const jumpToPhrase = React.useCallback((next) => {
    goTo(next);
    standRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [goTo]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowRight') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (event.key === 'Escape') stopAll();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, stopAll]);

  // ── What the staff and keys show ─────────────────────────────────────

  const practising = Boolean(practice);
  const current = practice && !practice.done ? steps[practice.index] : !practice ? steps[0] : null;
  const struck = practice && !practice.done ? practice.struck : [];
  const cursorTime = current ? current.time : null;
  const playing = playback.isPlaying;
  const activeMidis = React.useMemo(() => {
    if (!playing || !phrase || playhead === null) return [];
    return phrase.steps.flatMap((step) => step.notes)
      .filter((note) => (hands === 'both' || note.hand === hands) && note.time <= playhead + 0.02 && note.time + note.duration > playhead)
      .map((note) => note);
  }, [playing, phrase, playhead, hands]);

  const keyboardMarks = React.useMemo(() => {
    const marks = new Map();
    if (playing) activeMidis.forEach((note) => marks.set(note.midi, note.hand));
    else if (current && guide !== 'staff') current.notes.forEach((note) => marks.set(note.midi, note.hand));
    return marks;
  }, [playing, activeMidis, current, guide]);

  const keyboardRange = React.useMemo(() => {
    const all = phrase ? phrase.steps.flatMap((step) => step.notes.map((note) => note.midi)) : [48, 72];
    let low = Math.min(...all) - 2;
    let high = Math.max(...all) + 2;
    if (high - low < 30) {
      const middle = (low + high) / 2;
      low = Math.round(middle - 15);
      high = Math.round(middle + 15);
    }
    return { low: Math.max(21, low), high: Math.min(108, high) };
  }, [phrase]);

  const staffChords = phrase?.chords || [];
  const accuracy = practice ? practiceAccuracy(practice) : 1;
  const elapsed = practice?.done ? (practice.finishedAt - practice.startedAt) / 1000 : 0;
  const learnedCount = phrases.filter((p) => phraseStanding(progress, p.index) === 'learned').length;

  const prompt = (() => {
    if (!phrase) return null;
    if (playing) return { tone: 'listen', text: `Listening${slow ? ' slowly' : ''} — ${hands === 'both' ? 'both hands' : HANDS.find((h) => h.id === hands).label.toLowerCase()}. Watch the notes light up.` };
    if (practice?.done) {
      const clean = practice.misses === 0;
      const next = hands !== 'both' && accuracy >= 0.85
        ? 'Now try it with both hands.'
        : accuracy >= 0.9 ? 'On to the next phrase when you are ready.' : 'Play it again — slower is fine.';
      return { tone: clean ? 'clean' : 'done', text: `${clean ? 'Clean run!' : 'Phrase played.'} ${Math.round(accuracy * 100)}% right in ${formatClock(elapsed)}. ${next}` };
    }
    if (!current) return null;
    const names = guide === 'names' ? noteNames(current.notes, fifths).join(' + ') : null;
    const where = practising ? `Step ${practice.index + 1} of ${steps.length}` : 'Play the first notes to begin';
    if (guide === 'staff') return { tone: 'read', text: `${where} — read the highlighted notes on the staff and find them on your piano.` };
    return { tone: practising ? 'play' : 'ready', text: `${where}${names ? `: ${names}` : ' — play the marked keys'}.` };
  })();

  return (
    <div className="learn">
      <header className="learn-top">
        <a className="learn-top__home" href={HOME_HREF}>← Vangelis</a>
        <nav className="learn-top__pieces" aria-label="Pieces to learn">
          {LEARN_PIECES.map((entry) => (
            <a
              key={entry.slug}
              href={getLearnHref(entry.slug)}
              className={`learn-top__piece${entry.slug === piece.slug ? ' learn-top__piece--current' : ''}`}
              aria-current={entry.slug === piece.slug ? 'page' : undefined}
            >
              {entry.title}
            </a>
          ))}
        </nav>
        <MidiStatus status={midiInput.status} deviceName={midiInput.deviceName} />
      </header>

      <section className="learn-hero">
        <p className="learn-hero__kicker">Learn to play · {piece.composer}</p>
        <h1 className="learn-hero__title">{piece.title}</h1>
        <p className="learn-hero__intro">{piece.intro}</p>
        {lesson && (
          <dl className="learn-hero__facts">
            <div><dt>Home key</dt><dd><Music>{lesson.key.name}</Music></dd></div>
            <div><dt>Phrases</dt><dd>{phrases.length}</dd></div>
            <div><dt>Core chords</dt><dd>{lesson.vocabulary.length}</dd></div>
            <div><dt>Learned</dt><dd>{learnedCount} / {phrases.length}</dd></div>
          </dl>
        )}
      </section>

      {error && <p className="learn-error">This piece could not be loaded ({error.message}).</p>}
      {!lesson && !error && <p className="learn-loading">Reading the score…</p>}

      {phrase && (
        <section className="learn-stand" aria-label="Phrase practice" ref={standRef}>
          <div className="learn-stand__head">
            <div>
              <p className="learn-stand__eyebrow">
                Phrase {index + 1} of {phrases.length}
                {' · '}
                {phrase.bars ? `bars ${phrase.bars[0]}–${phrase.bars[1]}` : `${formatClock(phrase.start)}–${formatClock(phrase.end)}`}
                {' · '}
                {phrase.key.name}
              </p>
              <p className="learn-stand__chords">
                {phrase.chords.length
                  ? <Music>{phrase.chords.map((chord) => chord.label).join('  →  ')}</Music>
                  : 'Melody alone'}
              </p>
            </div>
            <div className="learn-stand__nav">
              <button type="button" className="learn-btn learn-btn--ghost" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous phrase">←</button>
              <button type="button" className="learn-btn learn-btn--ghost" onClick={() => goTo(index + 1)} disabled={index >= phrases.length - 1} aria-label="Next phrase">→</button>
            </div>
          </div>

          <div className="learn-paper" ref={staffRef}>
            <div className="learn-paper__scroll">
              <GrandStaff
                steps={phrase.steps}
                start={phrase.start}
                end={phrase.end}
                fifths={fifths}
                width={staffWidth - 8}
                hands={hands}
                chords={staffChords}
                showNames={guide === 'names'}
                cursorTime={playing ? null : cursorTime}
                struck={struck}
                playheadTime={playing ? playhead : null}
                label={`Phrase ${index + 1} on a grand staff`}
              />
            </div>
          </div>

          <div className="learn-controls">
            <div className="learn-segment" role="radiogroup" aria-label="Hands">
              {HANDS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={hands === option.id}
                  className={`learn-segment__option learn-segment__option--${option.id}${hands === option.id ? ' learn-segment__option--on' : ''}`}
                  onClick={() => setHands(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="learn-controls__main">
              <button type="button" className="learn-btn learn-btn--listen" onClick={listen}>
                {playing ? 'Stop' : 'Listen'}
              </button>
              <label className="learn-check">
                <input type="checkbox" checked={slow} onChange={(event) => setSlow(event.target.checked)} />
                Slow
              </label>
              <button type="button" className="learn-btn learn-btn--practice" onClick={begin}>
                {practice ? 'Restart' : 'Practice'}
              </button>
            </div>
            <div className="learn-segment learn-segment--small" role="radiogroup" aria-label="How much help">
              {GUIDES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={guide === option.id}
                  title={option.hint}
                  className={`learn-segment__option${guide === option.id ? ' learn-segment__option--on' : ''}`}
                  onClick={() => setGuide(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {prompt && (
            <div className={`learn-prompt learn-prompt--${prompt.tone}`} aria-live="polite">
              {practising && !practice.done && (
                <span className="learn-prompt__meter" aria-hidden="true">
                  <span style={{ width: `${(practice.index / steps.length) * 100}%` }} />
                </span>
              )}
              <p>{prompt.text}</p>
              {practice?.done && (
                <span className="learn-prompt__actions">
                  <button type="button" className="learn-btn learn-btn--ghost" onClick={begin}>Again</button>
                  {index < phrases.length - 1 && (
                    <button type="button" className="learn-btn learn-btn--practice" onClick={() => goTo(index + 1)}>Next phrase →</button>
                  )}
                </span>
              )}
            </div>
          )}

          <div className="learn-keys">
            <LearnKeyboard
              low={keyboardRange.low}
              high={keyboardRange.high}
              marks={keyboardMarks}
              held={held}
              struck={new Set(struck)}
              wrong={practice?.wrong || null}
              fifths={fifths}
              showNames={guide === 'names'}
              onPress={pressScreenKey}
              onRelease={releaseScreenKey}
              label="Keyboard: the keys to play are marked"
            />
          </div>
          <label className="learn-check learn-check--quiet">
            <input type="checkbox" checked={anyOctave} onChange={(event) => setAnyOctave(event.target.checked)} />
            Accept the right note in any octave (handy on a short keyboard)
          </label>

          <div className="learn-map" aria-label="All phrases">
            <p className="learn-map__title">The whole piece</p>
            <ol className="learn-map__tiles">
              {phrases.map((entry) => {
                const standing = phraseStanding(progress, entry.index);
                return (
                  <li key={entry.index}>
                    <button
                      type="button"
                      className={`learn-tile${entry.index === index ? ' learn-tile--current' : ''}${standing ? ` learn-tile--${standing}` : ''}`}
                      onClick={() => goTo(entry.index)}
                      aria-label={`Phrase ${entry.index + 1}${standing ? `, ${standing}` : ''}`}
                      aria-current={entry.index === index ? 'step' : undefined}
                    >
                      <span className="learn-tile__number">{entry.index + 1}</span>
                      <svg viewBox="-2 -2 60 22" className="learn-tile__contour" aria-hidden="true">
                        <polyline points={contourPoints(entry)} />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="learn-map__legend">
              <span className="learn-legend learn-legend--started">played</span>
              <span className="learn-legend learn-legend--practising">one hand at 80%</span>
              <span className="learn-legend learn-legend--learned">both hands at 90%</span>
            </p>
          </div>
        </section>
      )}

      {lesson && lesson.vocabulary.length > 0 && (
        <ChordShelf lesson={lesson} held={held} onJump={jumpToPhrase} pianoParams={pianoParams} />
      )}

      {lesson && (
        <ReadingRoom held={held} fifths={fifths} keyName={phrase?.key.name} keyText={keySignatureText(phrase?.key)} metered={Boolean(piece.barsPerPhrase)} />
      )}
    </div>
  );
};

/** The chords the piece is built on, each to hear, see and play. */
const ChordShelf = ({ lesson, held, onJump, pianoParams }) => {
  const heldClasses = React.useMemo(() => new Set([...held].map((midi) => midi % 12)), [held]);
  const where = React.useMemo(() => new Map(lesson.vocabulary.map((chord) => [
    chord.label,
    lesson.phrases.filter((phrase) => phrase.chords.some((c) => c.label.split('/')[0] === chord.label)).map((phrase) => phrase.index)
  ])), [lesson]);

  const hear = (chord) => {
    const notes = rootPosition(chord);
    notes.forEach((midi, i) => {
      window.setTimeout(() => {
        audioEngine.playFrequency({ noteId: `chord-${midi}`, frequency: midiNoteToFrequency(midi), params: pianoParams, velocity: 0.62 });
      }, i * 70);
      window.setTimeout(() => audioEngine.stopNote(`chord-${midi}`), 1800);
    });
  };

  return (
    <section className="learn-chords" aria-labelledby="learn-chords-title">
      <div className="learn-section-head">
        <h2 id="learn-chords-title">The chords</h2>
        <p>
          The {lesson.vocabulary.length} chords this piece leans on most, in the order they arrive.
          Hold one down on your piano and its card lights up. Numerals show each chord&apos;s place in the key.
        </p>
      </div>
      <div className="learn-chords__grid">
        {lesson.vocabulary.map((chord) => {
          const shape = rootPosition(chord);
          const got = chord.tones.every((pc) => heldClasses.has(pc));
          const appears = where.get(chord.label) || [];
          return (
            <article key={chord.label} className={`learn-chord${got ? ' learn-chord--got' : ''}`}>
              <header className="learn-chord__head">
                <h3><Music>{chord.label}</Music></h3>
                {chord.numeral && <span className="learn-chord__numeral">{chord.numeral}</span>}
              </header>
              <p className="learn-chord__quality">{chord.quality}</p>
              <LearnKeyboard
                low={48}
                high={71}
                marks={new Map(shape.map((midi) => [midi, 'tone']))}
                held={held}
                fifths={chord.key.fifths}
                showNames
                whiteWidth={15}
                height={62}
                label={`${chord.label}: ${shape.map((midi) => spellMidi(midi, chord.key.fifths).name).join(' ')}`}
              />
              <p className="learn-chord__tones">{shape.map((midi) => spellMidi(midi, chord.key.fifths).name).join(' · ')}</p>
              <p className="learn-chord__where">
                {got ? 'You’ve got it — that’s the shape.' : (
                  <>
                    In phrase{appears.length > 1 ? 's' : ''}{' '}
                    {appears.slice(0, 5).map((phraseIndex, i) => (
                      <React.Fragment key={phraseIndex}>
                        {i > 0 && ', '}
                        <button type="button" className="learn-link" onClick={() => onJump(phraseIndex)}>{phraseIndex + 1}</button>
                      </React.Fragment>
                    ))}
                    {appears.length > 5 && ` and ${appears.length - 5} more`}
                  </>
                )}
              </p>
              <footer className="learn-chord__foot">
                <button type="button" className="learn-btn learn-btn--ghost learn-btn--small" onClick={() => hear(chord)}>Hear it</button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
};

/** How to read the staff, with the learner's own keys drawn on it as they play. */
const ReadingRoom = ({ held, fifths, keyName, keyText, metered }) => {
  const notes = [...held].sort((a, b) => a - b).map((midi) => ({ midi, time: 0, duration: 0, hand: midi < 60 ? 'left' : 'right' }));
  const steps = notes.length ? [{ time: 0, notes }] : [];
  const names = notes.map((note) => spellMidi(note.midi, fifths).label).join('  ');
  return (
    <section className="learn-reading" aria-labelledby="learn-reading-title">
      <div className="learn-section-head">
        <h2 id="learn-reading-title">Reading the staff</h2>
        <p>Press any key — on your piano or below — and watch where it lands.</p>
      </div>
      <div className="learn-reading__body">
        <figure className="learn-reading__live">
          <div className="learn-paper learn-paper--small">
            <GrandStaff steps={steps} start={0} end={1} fifths={fifths} width={260} compact label="Your keys on the staff" />
          </div>
          <figcaption>{names || 'Nothing held yet'}</figcaption>
        </figure>
        <div className="learn-reading__cards">
          <article className="learn-fact">
            <h3><span className="learn-fact__swatch learn-fact__swatch--right" />Treble staff · right hand</h3>
            <p>Lines from the bottom: <strong>E G B D F</strong> — “Every Good Boy Does Fine”. Spaces spell <strong>F A C E</strong>.</p>
          </article>
          <article className="learn-fact">
            <h3><span className="learn-fact__swatch learn-fact__swatch--left" />Bass staff · left hand</h3>
            <p>Lines from the bottom: <strong>G B D F A</strong> — “Good Boys Do Fine Always”. Spaces: <strong>A C E G</strong> — “All Cows Eat Grass”.</p>
          </article>
          <article className="learn-fact">
            <h3>Middle C</h3>
            <p>Sits on its own short line between the two staves — the C nearest the middle of your piano, usually right under its name.</p>
          </article>
          <article className="learn-fact">
            <h3>Key signature{keyName ? ` · ${keyName}` : ''}</h3>
            <p>{keyText}</p>
          </article>
          <article className="learn-fact">
            <h3>Time on this staff</h3>
            <p>
              Notes are spaced by when they are played, and the faint trail after each one shows how long to hold it.
              {metered
                ? ' Thin vertical lines mark the bars; count two beats in each.'
                : ' This piece is played freely, so there is no beat to count — follow the shape of each phrase.'}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
};

export default LearnPage;
