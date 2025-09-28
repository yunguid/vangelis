import React, { useState, useEffect } from 'react';
import { playNote, initAudioContext } from '../utils/audio';

const baseNotes = [
  { name: 'C', freq: 261.63 },
  { name: 'C#', freq: 277.18, isBlack: true },
  { name: 'D', freq: 293.66 },
  { name: 'D#', freq: 311.13, isBlack: true },
  { name: 'E', freq: 329.63 },
  { name: 'F', freq: 349.23 },
  { name: 'F#', freq: 369.99, isBlack: true },
  { name: 'G', freq: 392.0 },
  { name: 'G#', freq: 415.3, isBlack: true },
  { name: 'A', freq: 440.0 },
  { name: 'A#', freq: 466.16, isBlack: true },
  { name: 'B', freq: 493.88 }
];

const abletonKeyMap = {
  a: { name: 'C', delta: 0 },
  s: { name: 'D', delta: 0 },
  d: { name: 'E', delta: 0 },
  f: { name: 'F', delta: 0 },
  g: { name: 'G', delta: 0 },
  h: { name: 'A', delta: 0 },
  j: { name: 'B', delta: 0 },
  k: { name: 'C', delta: 1 },
  l: { name: 'D', delta: 1 },
  ';': { name: 'E', delta: 1 },
  "'": { name: 'F', delta: 1 },
  w: { name: 'C#', delta: 0 },
  e: { name: 'D#', delta: 0 },
  t: { name: 'F#', delta: 0 },
  y: { name: 'G#', delta: 0 },
  u: { name: 'A#', delta: 0 },
  o: { name: 'C#', delta: 1 },
  p: { name: 'D#', delta: 1 }
};

const notePrimaryKeyLabel = {
  'C@0': 'A', 'D@0': 'S', 'E@0': 'D', 'F@0': 'F', 'G@0': 'G', 'A@0': 'H', 'B@0': 'J',
  'C#@0': 'W', 'D#@0': 'E', 'F#@0': 'T', 'G#@0': 'Y', 'A#@0': 'U',
  'C@1': 'K', 'D@1': 'L', 'E@1': ';', 'F@1': "'",
  'C#@1': 'O', 'D#@1': 'P'
};

const whiteNotes = [
  { name: 'C', rel: 0, index: 0 },
  { name: 'D', rel: 0, index: 1 },
  { name: 'E', rel: 0, index: 2 },
  { name: 'F', rel: 0, index: 3 },
  { name: 'G', rel: 0, index: 4 },
  { name: 'A', rel: 0, index: 5 },
  { name: 'B', rel: 0, index: 6 },
  { name: 'C', rel: 1, index: 7 },
  { name: 'D', rel: 1, index: 8 },
  { name: 'E', rel: 1, index: 9 },
  { name: 'F', rel: 1, index: 10 }
];

const blackNotes = [
  { name: 'C#', rel: 0, positionIndex: 0 },
  { name: 'D#', rel: 0, positionIndex: 1 },
  { name: 'F#', rel: 0, positionIndex: 3 },
  { name: 'G#', rel: 0, positionIndex: 4 },
  { name: 'A#', rel: 0, positionIndex: 5 },
  { name: 'C#', rel: 1, positionIndex: 7 },
  { name: 'D#', rel: 1, positionIndex: 8 }
];

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  const [activeNotes, setActiveNotes] = useState({});
  const [keyToNoteId, setKeyToNoteId] = useState({});
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [velocity, setVelocity] = useState(100);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();

      if (key === 'z') {
        setOctaveOffset(oct => oct - 1);
        event.preventDefault();
        return;
      }

      if (key === 'x') {
        setOctaveOffset(oct => oct + 1);
        event.preventDefault();
        return;
      }

      if (key === 'c') {
        setVelocity(v => Math.max(1, v - 8));
        event.preventDefault();
        return;
      }

      if (key === 'v') {
        setVelocity(v => Math.min(127, v + 8));
        event.preventDefault();
        return;
      }

      const mapped = abletonKeyMap[key];
      if (mapped) {
        const noteObj = baseNotes.find(n => n.name === mapped.name);
        if (noteObj) handleNoteOn(noteObj, key, mapped.delta);
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key in keyToNoteId) {
        const noteId = keyToNoteId[key];
        handleNoteOffById(noteId, key);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octaveOffset, waveformType, audioParams, wasmLoaded, keyToNoteId]);

  const getFrequencyForNote = (freq, relDelta = 0) => freq * Math.pow(2, octaveOffset + relDelta);

  const handleNoteOn = (noteObj, physicalKey, relDelta = 0) => {
    if (!wasmLoaded) return;
    initAudioContext();

    const noteId = `${noteObj.name}@${octaveOffset + relDelta}`;
    if (physicalKey) {
      if (keyToNoteId[physicalKey]) return;
    } else if (activeNotes[noteId]) {
      return;
    }

    setActiveNotes(prev => ({
      ...prev,
      [noteId]: { source: null, time: Date.now(), pending: true }
    }));

    const frequency = getFrequencyForNote(noteObj.freq, relDelta);
    const baseVolume = audioParams.volume ?? 0.7;
    const volScaled = Math.max(0, Math.min(1, baseVolume * (velocity / 127)));
    const effectiveParams = { ...audioParams, volume: volScaled };
    const result = playNote(frequency, 1.0, waveformType, effectiveParams);

    if (result) {
      const { source, analyser } = result;
      setActiveNotes(prev => ({
        ...prev,
        [noteId]: { source, time: Date.now() }
      }));
      if (physicalKey) {
        setKeyToNoteId(prev => ({ ...prev, [physicalKey]: noteId }));
      }
      window.lastAnalyser = analyser;
    }
  };

  const handleNoteOffById = (noteId, physicalKey) => {
    if (activeNotes[noteId]) {
      const noteData = activeNotes[noteId];
      const timePlayed = Date.now() - noteData.time;
      const stopAndCleanup = () => {
        if (noteData.source) {
          noteData.source.stop();
        }
        setActiveNotes(prev => {
          const updated = { ...prev };
          delete updated[noteId];
          return updated;
        });
        if (physicalKey) {
          setKeyToNoteId(prev => {
            const updated = { ...prev };
            delete updated[physicalKey];
            return updated;
          });
        }
      };

      if (timePlayed < 100) {
        setTimeout(stopAndCleanup, 100 - timePlayed);
      } else {
        stopAndCleanup();
      }
    }
  };

  const handleNoteOff = (noteObj, relDelta = 0, physicalKey) => {
    const noteId = `${noteObj.name}@${octaveOffset + relDelta}`;
    handleNoteOffById(noteId, physicalKey);
  };

  const handleOnByName = (noteName, relDelta = 0) => {
    const base = baseNotes.find(n => n.name === noteName);
    if (base) {
      handleNoteOn(base, undefined, relDelta);
    }
  };

  const handleOffByName = (noteName, relDelta = 0) => {
    const base = baseNotes.find(n => n.name === noteName);
    if (base) {
      handleNoteOff(base, relDelta);
    }
  };

  if (!wasmLoaded) {
    return (
      <div className="keyboard-loading" role="status" aria-live="polite">
        Loading synthesizer…
      </div>
    );
  }

  const whiteKeyCount = whiteNotes.length;
  const whiteSegment = 100 / whiteKeyCount;

  return (
    <div className="white-keys" role="application" aria-label="Synth keyboard">
      {whiteNotes.map(note => {
        const noteId = `${note.name}@${note.rel + octaveOffset}`;
        const isActive = Boolean(activeNotes[noteId]);
        return (
          <button
            key={`${note.name}-${note.rel}`}
            type="button"
            className={`key-white${isActive ? ' active' : ''}`}
            aria-label={`${note.name} note`}
            aria-pressed={isActive}
            onMouseDown={() => handleOnByName(note.name, note.rel)}
            onMouseUp={() => handleOffByName(note.name, note.rel)}
            onMouseLeave={() => handleOffByName(note.name, note.rel)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleOnByName(note.name, note.rel);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleOffByName(note.name, note.rel);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              handleOffByName(note.name, note.rel);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOnByName(note.name, note.rel);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOffByName(note.name, note.rel);
              }
            }}
          >
            <span className="note-label">{note.name}</span>
            <span className="key-label">{notePrimaryKeyLabel[`${note.name}@${note.rel}`] || ''}</span>
            {isActive && <span className="key-active-indicator" aria-hidden="true" />}
          </button>
        );
      })}

      <div className="black-keys-layer">
        {blackNotes.map(note => {
          const noteId = `${note.name}@${note.rel + octaveOffset}`;
          const isActive = Boolean(activeNotes[noteId]);
          const leftPercent = ((note.positionIndex + 1) * whiteSegment);
          return (
            <button
              key={`${note.name}-${note.rel}`}
              type="button"
              className={`key-black${isActive ? ' active' : ''}`}
              style={{ left: `${leftPercent}%` }}
              aria-label={`${note.name} note`}
              aria-pressed={isActive}
              onMouseDown={() => handleOnByName(note.name, note.rel)}
              onMouseUp={() => handleOffByName(note.name, note.rel)}
              onMouseLeave={() => handleOffByName(note.name, note.rel)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleOnByName(note.name, note.rel);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleOffByName(note.name, note.rel);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                handleOffByName(note.name, note.rel);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOnByName(note.name, note.rel);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOffByName(note.name, note.rel);
                }
              }}
            >
              <span className="note-label">{note.name}</span>
              <span className="key-label">{notePrimaryKeyLabel[`${note.name}@${note.rel}`] || ''}</span>
              {isActive && <span className="key-active-indicator" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SynthKeyboard;
