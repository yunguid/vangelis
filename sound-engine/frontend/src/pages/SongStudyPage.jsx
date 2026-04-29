import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import BirdsEyeRadar from '../components/BirdsEyeRadar.jsx';
import SynthKeyboard from '../components/SynthKeyboard';
import { DEFAULT_STUDY_AUDIO_PARAMS, DEFAULT_STUDY_WAVEFORM } from '../data/songStudies.js';
import { useMidiPlayback } from '../hooks/useMidiPlayback.js';
import { audioEngine } from '../utils/audioEngine.js';
import { midiNoteToName } from '../utils/math.js';
import { parseMidiFile } from '../utils/midiParser.js';
import './SongStudyPage.css';

const TEMPO_OPTIONS = [
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 }
];
const FLAT_PITCH_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_PATTERNS = [
  { suffix: 'maj7', intervals: [0, 4, 7, 11], weight: 9 },
  { suffix: 'm7', intervals: [0, 3, 7, 10], weight: 9 },
  { suffix: '7', intervals: [0, 4, 7, 10], weight: 8 },
  { suffix: 'm', intervals: [0, 3, 7], weight: 7 },
  { suffix: '', intervals: [0, 4, 7], weight: 7 },
  { suffix: 'sus2', intervals: [0, 2, 7], weight: 5 },
  { suffix: 'sus4', intervals: [0, 5, 7], weight: 5 },
  { suffix: '5', intervals: [0, 7], weight: 3 }
];
const KEYBOARD_MIN_MIDI = 60;
const KEYBOARD_MAX_MIDI = 77;
const LOOK_BEHIND_SECONDS = 0.08;
const LOOK_AHEAD_SECONDS = 0.24;
const FALLBACK_LOOK_AHEAD_SECONDS = 0.42;

const formatPitchClass = (pitchClass) => FLAT_PITCH_NAMES[((pitchClass % 12) + 12) % 12];

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatMidiLabel = (midi) => {
  const octave = Math.floor(midi / 12) - 1;
  return `${formatPitchClass(midi % 12)}${octave}`;
};

const resolveDuration = (notes, fallbackDuration) => {
  const derivedDuration = notes.reduce(
    (longest, note) => Math.max(longest, note.time + note.duration),
    0
  );
  return derivedDuration > 0 ? derivedDuration : fallbackDuration;
};

const getNotesAroundTime = (notes, time) => {
  const activeNotes = notes.filter((note) => (
    note.time <= time + LOOK_BEHIND_SECONDS
    && note.time + note.duration >= time - LOOK_BEHIND_SECONDS
  ));

  if (activeNotes.length > 0) {
    return activeNotes;
  }

  const upcomingNotes = notes.filter((note) => (
    note.time >= time
    && note.time <= time + FALLBACK_LOOK_AHEAD_SECONDS
  ));

  if (upcomingNotes.length === 0) {
    return [];
  }

  const anchorTime = upcomingNotes[0].time;
  return upcomingNotes.filter((note) => Math.abs(note.time - anchorTime) <= LOOK_AHEAD_SECONDS);
};

const detectChordLabel = (notes) => {
  if (notes.length === 0) {
    return 'Waiting';
  }

  const pitchClasses = [...new Set(notes.map((note) => ((note.midi % 12) + 12) % 12))];
  if (pitchClasses.length === 1) {
    return formatPitchClass(pitchClasses[0]);
  }

  const bassPitchClass = ((notes.reduce(
    (lowest, note) => (note.midi < lowest.midi ? note : lowest),
    notes[0]
  ).midi % 12) + 12) % 12;
  const rootCandidates = [bassPitchClass, ...pitchClasses.filter((pc) => pc !== bassPitchClass)];

  let bestMatch = null;

  rootCandidates.forEach((rootPitchClass) => {
    const relativeIntervals = new Set(
      pitchClasses.map((pitchClass) => (pitchClass - rootPitchClass + 12) % 12)
    );

    CHORD_PATTERNS.forEach((pattern) => {
      const matches = pattern.intervals.filter((interval) => relativeIntervals.has(interval)).length;
      const requiredMatches = Math.min(
        pattern.intervals.length,
        pitchClasses.length >= 3 ? 3 : pitchClasses.length
      );

      if (matches < requiredMatches) {
        return;
      }

      const extras = [...relativeIntervals].filter((interval) => !pattern.intervals.includes(interval)).length;
      const score = (
        matches * 12
        - extras * 3
        + pattern.weight
        + (rootPitchClass === bassPitchClass ? 4 : 0)
      );

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { rootPitchClass, suffix: pattern.suffix, score };
      }
    });
  });

  if (bestMatch) {
    return `${formatPitchClass(bestMatch.rootPitchClass)}${bestMatch.suffix}`;
  }

  return pitchClasses.map(formatPitchClass).join(' / ');
};

const foldNotesToKeyboard = (notes) => {
  const foldedNoteIds = new Set();
  const usedMidiNumbers = new Set();

  notes.forEach((note) => {
    let foldedMidi = note.midi;

    while (foldedMidi < KEYBOARD_MIN_MIDI) foldedMidi += 12;
    while (foldedMidi > KEYBOARD_MAX_MIDI) foldedMidi -= 12;

    if (foldedMidi < KEYBOARD_MIN_MIDI || foldedMidi > KEYBOARD_MAX_MIDI) {
      return;
    }

    if (usedMidiNumbers.has(foldedMidi)) {
      return;
    }

    usedMidiNumbers.add(foldedMidi);
    foldedNoteIds.add(midiNoteToName(foldedMidi).noteId);
  });

  return foldedNoteIds;
};

const useSingleLineTitle = (title) => {
  const titleRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const element = titleRef.current;
    if (!element) return undefined;

    const fitTitle = () => {
      element.style.removeProperty('font-size');

      const containerWidth = element.parentElement?.clientWidth || 0;
      if (containerWidth === 0) {
        return;
      }

      const computedStyle = window.getComputedStyle(element);
      const minimumSize = Number.parseFloat(
        computedStyle.getPropertyValue('--song-study-title-min')
      ) || 28;
      const baseSize = Number.parseFloat(computedStyle.fontSize) || minimumSize;
      const measuredWidth = element.scrollWidth;

      if (measuredWidth <= containerWidth + 1) {
        return;
      }

      const fittedSize = Math.max(
        minimumSize,
        baseSize * ((containerWidth - 2) / measuredWidth)
      );

      element.style.fontSize = `${fittedSize}px`;
    };

    fitTitle();

    const parent = element.parentElement;
    const resizeObserver = (
      typeof ResizeObserver === 'function' && parent
        ? new ResizeObserver(fitTitle)
        : null
    );

    if (resizeObserver && parent) {
      resizeObserver.observe(parent);
    }

    window.addEventListener('resize', fitTitle);
    document.fonts?.ready?.then(fitTitle).catch(() => {});

    return () => {
      window.removeEventListener('resize', fitTitle);
      resizeObserver?.disconnect();
    };
  }, [title]);

  return titleRef;
};

const TransportIcon = ({ kind }) => {
  if (kind === 'pause') {
    return (
      <svg className="song-study__action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="4" y="3.5" width="4" height="13" rx="1" />
        <rect x="12" y="3.5" width="4" height="13" rx="1" />
      </svg>
    );
  }

  if (kind === 'restart') {
    return (
      <svg className="song-study__action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
          d="M5 8a5 5 0 1 1 1.2 6.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M5.2 4.5v4.8H10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'stop') {
    return (
      <svg className="song-study__action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="4.5" y="4.5" width="11" height="11" rx="1.4" />
      </svg>
    );
  }

  return (
    <svg className="song-study__action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 3.5 15.5 10 5 16.5Z" />
    </svg>
  );
};

const SongStudyPage = ({ study }) => {
  const waveformType = study?.waveformType || DEFAULT_STUDY_WAVEFORM;
  const audioParams = study?.audioParams || DEFAULT_STUDY_AUDIO_PARAMS;
  const titleRef = useSingleLineTitle(study?.title || '');
  const [engineStatus, setEngineStatus] = React.useState(() => audioEngine.getStatus());
  const [loadedMidi, setLoadedMidi] = React.useState(null);
  const [loadState, setLoadState] = React.useState('loading');
  const [loadError, setLoadError] = React.useState('');
  const [queuedStartTime, setQueuedStartTime] = React.useState(0);
  const playback = useMidiPlayback({ waveformType, audioParams });

  React.useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);

    audioEngine.ensureWasm().catch(() => {});
    audioEngine.ensureAudioContext().then(() => {
      audioEngine.warmGraph();
    }).catch(() => {});

    return () => {
      playback.stop();
      unsubscribe();
    };
  }, [playback.stop]);

  React.useEffect(() => {
    let cancelled = false;

    if (!study?.midiUrl) {
      setLoadState('error');
      setLoadError('This study does not have a merged MIDI yet.');
      return () => {
        cancelled = true;
      };
    }

    setLoadState('loading');
    setLoadError('');

    parseMidiFile(study.midiUrl).then((midi) => {
      if (cancelled) return;

      const pitchedNotes = midi.notes.filter((note) => (
        note.channel !== 9
        && note.instrumentFamily !== 'percussive'
        && note.instrumentFamily !== 'sound effects'
      ));

      setLoadedMidi({
        ...midi,
        name: study.title,
        notes: pitchedNotes,
        duration: resolveDuration(pitchedNotes, midi.duration)
      });
      setLoadState('ready');
    }).catch((error) => {
      if (cancelled) return;
      console.error(`Failed to load study MIDI for ${study?.title || 'song'}:`, error);
      setLoadState('error');
      setLoadError('The study MIDI could not be loaded.');
    });

    return () => {
      cancelled = true;
    };
  }, [study?.midiUrl, study?.title]);

  React.useEffect(() => {
    const bpm = loadedMidi?.bpm || playback.currentMidi?.bpm;
    if (!bpm) return;
    audioEngine.setTransportTempo?.(bpm * playback.tempoFactor);
  }, [loadedMidi?.bpm, playback.currentMidi?.bpm, playback.tempoFactor]);

  React.useEffect(() => {
    setQueuedStartTime(0);
  }, [study?.id]);

  const displayMidi = playback.currentMidi || loadedMidi;
  const firstNoteTime = displayMidi?.notes?.[0]?.time || 0;
  const transportDuration = displayMidi?.duration || 0;
  const transportElapsed = transportDuration > 0 ? playback.progress * transportDuration : 0;
  const hasActiveTransport = playback.isPlaying || playback.isPaused;
  const transportPosition = hasActiveTransport ? transportElapsed : queuedStartTime;
  const previewTime = (
    hasActiveTransport
    || queuedStartTime > 0
  )
    ? transportPosition
    : firstNoteTime;

  const visibleNotes = React.useMemo(
    () => (displayMidi ? getNotesAroundTime(displayMidi.notes, previewTime) : []),
    [displayMidi, previewTime]
  );

  const bassNote = React.useMemo(() => (
    visibleNotes.reduce(
      (lowest, note) => (!lowest || note.midi < lowest.midi ? note : lowest),
      null
    )
  ), [visibleNotes]);
  const leadNote = React.useMemo(() => (
    visibleNotes.reduce(
      (highest, note) => (!highest || note.midi > highest.midi ? note : highest),
      null
    )
  ), [visibleNotes]);

  const harmonyLabel = React.useMemo(() => detectChordLabel(visibleNotes), [visibleNotes]);
  const chordTones = React.useMemo(() => (
    [...new Set(visibleNotes.map((note) => formatPitchClass(note.midi % 12)))].join(' / ') || 'Ready'
  ), [visibleNotes]);
  const radarActiveNotes = React.useMemo(() => (
    new Set(visibleNotes.map((note) => midiNoteToName(note.midi).noteId))
  ), [visibleNotes]);
  const foldedKeyboardNotes = React.useMemo(
    () => foldNotesToKeyboard(visibleNotes),
    [visibleNotes]
  );

  const seekToTime = React.useCallback((nextTime) => {
    if (!transportDuration) return;

    const clampedTime = Math.min(Math.max(nextTime, 0), transportDuration);

    if (hasActiveTransport) {
      playback.seekTo(clampedTime);
    } else {
      setQueuedStartTime(clampedTime);
    }
  }, [hasActiveTransport, playback, transportDuration]);

  const handlePlayToggle = () => {
    if (!loadedMidi) return;

    if (playback.isPlaying) {
      playback.pause();
      return;
    }

    if (playback.isPaused) {
      playback.resume();
      return;
    }

    playback.play(loadedMidi, { startAt: queuedStartTime });
  };

  const handleRestart = () => {
    if (!loadedMidi) return;
    setQueuedStartTime(0);
    playback.play(loadedMidi, { startAt: 0 });
  };

  const handleStop = () => {
    playback.stop();
    setQueuedStartTime(0);
  };

  const handleScrubChange = (event) => {
    seekToTime(Number(event.target.value));
  };

  const handleSkip = (deltaSeconds) => {
    seekToTime(transportPosition + deltaSeconds);
  };

  return (
    <div className="song-study">
      <div className="song-study__backdrop" aria-hidden="true" />

      <main className="song-study__shell">
        <AppHeader activeSection="studies" />

        <header className="song-study__masthead">
          <div className="song-study__title-group">
            <span className="song-study__eyebrow">{study.eyebrow}</span>
            <h1 ref={titleRef}>{study.title}</h1>
          </div>

          <div className="song-study__status">
            <span
              className={`song-study__status-dot ${engineStatus.graphWarmed ? 'is-ready' : ''}`}
              aria-hidden="true"
            />
            <span>{engineStatus.graphWarmed ? 'Audio ready' : 'Warming audio'}</span>
          </div>
        </header>

        <section className="song-study__transport" aria-label="MIDI transport">
          <div className="song-study__progress">
            <input
              type="range"
              className="song-study__scrubber"
              min="0"
              max={transportDuration || 0}
              step="0.1"
              value={Math.min(transportPosition, transportDuration || 0)}
              onChange={handleScrubChange}
              disabled={!transportDuration}
              aria-label="Study transport"
              style={{
                '--song-study-progress': `${
                  transportDuration > 0
                    ? Math.min((transportPosition / transportDuration) * 100, 100)
                    : 0
                }%`
              }}
            />

            <div className="song-study__progress-track" aria-hidden="true">
              <span
                className="song-study__progress-fill"
                style={{
                  width: `${
                    transportDuration > 0
                      ? Math.min((transportPosition / transportDuration) * 100, 100)
                      : 0
                  }%`
                }}
              />
            </div>
            <div className="song-study__progress-meta">
              <span>{formatTime(transportPosition)}</span>
              <span>{displayMidi ? `${Math.round(displayMidi.bpm * playback.tempoFactor)} BPM` : 'Loading MIDI'}</span>
              <span>{formatTime(transportDuration)}</span>
            </div>
          </div>

          <div className="song-study__transport-row">
            <div className="song-study__transport-main">
              <button
                type="button"
                className="song-study__action song-study__action--primary"
                onClick={handlePlayToggle}
                disabled={loadState !== 'ready'}
                aria-label={playback.isPlaying ? 'Pause' : playback.isPaused ? 'Resume' : 'Play'}
              >
                <TransportIcon kind={playback.isPlaying ? 'pause' : 'play'} />
              </button>

              <button
                type="button"
                className="song-study__action"
                onClick={handleRestart}
                disabled={loadState !== 'ready'}
                aria-label="Restart"
              >
                <TransportIcon kind="restart" />
              </button>

              <button
                type="button"
                className="song-study__action"
                onClick={handleStop}
                disabled={!playback.isPlaying && !playback.isPaused && queuedStartTime <= 0}
                aria-label="Stop"
              >
                <TransportIcon kind="stop" />
              </button>
            </div>

            <div className="song-study__seek-tools">
              <div className="song-study__skip-group">
                <button
                  type="button"
                  className="song-study__tempo-chip"
                  onClick={() => handleSkip(-10)}
                  disabled={!transportDuration}
                >
                  -10s
                </button>
                <button
                  type="button"
                  className="song-study__tempo-chip"
                  onClick={() => handleSkip(10)}
                  disabled={!transportDuration}
                >
                  +10s
                </button>
              </div>
            </div>

            <div className="song-study__tempo">
              {TEMPO_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`song-study__tempo-chip ${Math.abs(playback.tempoFactor - option.value) < 0.001 ? 'is-active' : ''}`}
                  onClick={() => playback.setTempo(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="song-study__readouts" aria-label="Current harmony">
          <article className="song-study__metric">
            <span>Chord</span>
            <strong>{harmonyLabel}</strong>
            <p>{chordTones}</p>
          </article>

          <article className="song-study__metric">
            <span>Bass</span>
            <strong>{bassNote ? formatMidiLabel(bassNote.midi) : 'Waiting'}</strong>
            <p>lowest active voice</p>
          </article>

          <article className="song-study__metric">
            <span>Lead</span>
            <strong>{leadNote ? formatMidiLabel(leadNote.midi) : 'Waiting'}</strong>
            <p>highest active voice</p>
          </article>
        </section>

        {loadState === 'error' && (
          <section className="song-study__error" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="song-study__action song-study__action--primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </section>
        )}

        <section className="song-study__stage" aria-label="Song follow view">
          <div className="keyboard-region">
            <BirdsEyeRadar
              currentMidi={displayMidi}
              progress={playback.progress}
              activeNotes={radarActiveNotes}
              isPlaying={playback.isPlaying}
            />

            <SynthKeyboard
              waveformType={waveformType}
              audioParams={audioParams}
              wasmLoaded={engineStatus.wasmReady}
              externalActiveNotes={foldedKeyboardNotes}
            />

            {!engineStatus.graphWarmed && (
              <div className="warmup-indicator" aria-live="polite">
                <span className="warmup-indicator__pulse" aria-hidden="true" />
                <span>Visuals are live while the audio engine warms.</span>
              </div>
            )}

            <div className="keyboard-hints">
              <span className="keyboard-hint">
                Radar shows the full register. Keyboard folds the current voicing into the playable range.
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SongStudyPage;
