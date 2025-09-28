import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { playNote, initAudioContext } from '../utils/audio';

/**
 * We'll define a set of note names, their frequencies at "octave 4",
 * then apply an octave offset. That offset is changed with 'z' (down) / 'x' (up).
 * 
 * We'll also fix the layout so black keys appear between the correct white keys.
 */
const baseNotes = [
  { name: 'C',  freq: 261.63 },
  { name: 'C#', freq: 277.18, isBlack: true },
  { name: 'D',  freq: 293.66 },
  { name: 'D#', freq: 311.13, isBlack: true },
  { name: 'E',  freq: 329.63 },
  { name: 'F',  freq: 349.23 },
  { name: 'F#', freq: 369.99, isBlack: true },
  { name: 'G',  freq: 392.00 },
  { name: 'G#', freq: 415.30, isBlack: true },
  { name: 'A',  freq: 440.00 },
  { name: 'A#', freq: 466.16, isBlack: true },
  { name: 'B',  freq: 493.88 }
];
// Ableton-like Computer MIDI Keyboard mapping
const abletonKeyMap = {
  // white keys (current octave)
  'a': { name: 'C',  delta: 0 },
  's': { name: 'D',  delta: 0 },
  'd': { name: 'E',  delta: 0 },
  'f': { name: 'F',  delta: 0 },
  'g': { name: 'G',  delta: 0 },
  'h': { name: 'A',  delta: 0 },
  'j': { name: 'B',  delta: 0 },
  // white keys (next octave)
  'k': { name: 'C',  delta: 1 },
  'l': { name: 'D',  delta: 1 },
  ';': { name: 'E',  delta: 1 },
  "'": { name: 'F',  delta: 1 },
  // black keys (current octave)
  'w': { name: 'C#', delta: 0 },
  'e': { name: 'D#', delta: 0 },
  't': { name: 'F#', delta: 0 },
  'y': { name: 'G#', delta: 0 },
  'u': { name: 'A#', delta: 0 },
  // black keys (next octave)
  'o': { name: 'C#', delta: 1 },
  'p': { name: 'D#', delta: 1 }
};

// Labels to show physical keys on UI
const notePrimaryKeyLabel = {
  'C@0': 'A', 'D@0': 'S', 'E@0': 'D', 'F@0': 'F', 'G@0': 'G', 'A@0': 'H', 'B@0': 'J',
  'C#@0': 'W', 'D#@0': 'E', 'F#@0': 'T', 'G#@0': 'Y', 'A#@0': 'U',
  'C@1': 'K', 'D@1': 'L', 'E@1': ';', 'F@1': "'",
  'C#@1': 'O', 'D#@1': 'P'
};

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  // Map of noteId => { source, time }
  const [activeNotes, setActiveNotes] = useState({});
  // Map of physical keyboard key => noteId (so we can stop the right one when offset changes)
  const [keyToNoteId, setKeyToNoteId] = useState({});
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [velocity, setVelocity] = useState(100); // 1..127

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();

      // Octave shifting
      if (key === 'z') {
        setOctaveOffset(oct => oct - 1);
        event.preventDefault();
        return;
      } else if (key === 'x') {
        setOctaveOffset(oct => oct + 1);
        event.preventDefault();
        return;
      } else if (key === 'c') {
        setVelocity(v => Math.max(1, v - 8));
        event.preventDefault();
        return;
      } else if (key === 'v') {
        setVelocity(v => Math.min(127, v + 8));
        event.preventDefault();
        return;
      }

      // Note playing (Ableton-like mapping)
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
  }, [octaveOffset, waveformType, audioParams, wasmLoaded]);

  // Compute actual frequency for a note + current octave offset
  const getFrequencyForNote = (freq, relDelta = 0) => {
    // Each full octave shift => multiply or divide by 2
    // octaveOffset = +1 => freq * 2, -1 => freq / 2, etc.
    return freq * Math.pow(2, octaveOffset + relDelta);
  };

  const handleNoteOn = (noteObj, physicalKey, relDelta = 0) => {
    if (!wasmLoaded) return;
    initAudioContext();

    const noteId = `${noteObj.name}@${octaveOffset + relDelta}`;
    if (physicalKey) {
      if (keyToNoteId[physicalKey]) return; // that key already holds a note
    } else if (activeNotes[noteId]) {
      return; // mouse/touch duplicate
    }

    // Immediate visual feedback
    setActiveNotes(prev => ({ ...prev, [noteId]: { source: null, time: Date.now(), pending: true } }));

    const frequency = getFrequencyForNote(noteObj.freq, relDelta);
    const volBase = (audioParams.volume ?? 0.7);
    const volScaled = Math.max(0, Math.min(1, volBase * (velocity / 127)));
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
        noteData.source.stop();
        setActiveNotes(prev => {
          const newState = { ...prev };
          delete newState[noteId];
          return newState;
        });
        if (physicalKey) {
          setKeyToNoteId(prev => {
            const copy = { ...prev };
            delete copy[physicalKey];
            return copy;
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

  const handleNoteOff = (noteObj) => {
    const noteId = `${noteObj.name}@${octaveOffset}`;
    handleNoteOffById(noteId);
  };

  // If WASM not loaded, show loading
  if (!wasmLoaded) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-neon-cyan font-orbitron animate-pulse text-lg">
          <span className="inline-block animate-bounce mr-2">⚡</span>
          Loading synthesizer...
          <span className="inline-block animate-bounce ml-2">⚡</span>
        </p>
      </div>
    );
  }

  // Display ~1.5 octaves to align with Ableton mapping and labels
  const whiteNotes = [
    { name: 'C', rel: 0 }, { name: 'D', rel: 0 }, { name: 'E', rel: 0 }, { name: 'F', rel: 0 }, { name: 'G', rel: 0 }, { name: 'A', rel: 0 }, { name: 'B', rel: 0 },
    { name: 'C', rel: 1 }, { name: 'D', rel: 1 }, { name: 'E', rel: 1 }, { name: 'F', rel: 1 }
  ];
  const blackNotes = [
    { name: 'C#', rel: 0 }, { name: 'D#', rel: 0 },
    { name: 'F#', rel: 0 }, { name: 'G#', rel: 0 }, { name: 'A#', rel: 0 },
    { name: 'C#', rel: 1 }, { name: 'D#', rel: 1 }
  ];

  return (
    <motion.div 
      className="px-4 w-full max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, type: "spring" }}
    >
      {/* White keys container */}
      <div className="relative flex">
        {whiteNotes.map((note, idx) => {
          const noteId = `${note.name}@${note.rel + octaveOffset}`;
          const isActive = !!activeNotes[noteId];
          return (
            <motion.div
              key={note.name}
              className={`key ${isActive ? 'border-neon-pink shadow-neon-pink' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ 
                scale: 0.95,
                boxShadow: '0 0 15px #FF1E88, 0 0 25px #FF1E88'
              }}
              onMouseDown={() => {
                const base = baseNotes.find(n => n.name === note.name);
                if (base) handleNoteOn(base, undefined, note.rel);
              }}
              onMouseUp={() => {
                const base = baseNotes.find(n => n.name === note.name);
                if (base) handleNoteOff(base, note.rel);
              }}
              onMouseLeave={() => {
                if (isActive) {
                  const base = baseNotes.find(n => n.name === note.name);
                  if (base) handleNoteOff(base, note.rel);
                }
              }}
              onTouchStart={(e) => { e.preventDefault(); const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOn(base, undefined, note.rel); }}
              onTouchEnd={(e) => { e.preventDefault(); const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOff(base, note.rel); }}
              style={{
                height: 'clamp(80px, 15vh, 140px)',
                width: 'clamp(35px, 6vw, 60px)'
              }}
            >
              <span className="absolute bottom-2 font-bold">
                {note.name}
              </span>
              <span className="absolute top-1 left-1 text-[10px] opacity-70">{notePrimaryKeyLabel[`${note.name}@${note.rel}`] || ''}</span>
              {isActive && (
                <motion.div
                  className="absolute inset-0 bg-neon-pink opacity-10 rounded-b-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                />
              )}
            </motion.div>
          );
        })}

        {/* Black keys: position them above the whites, in correct spots */}
        {blackNotes.map(note => {
          const noteId = `${note.name}@${note.rel + octaveOffset}`;
          const isActive = !!activeNotes[noteId];
          const placementIndex = getPlacementIndex(note.name) + (note.rel === 1 ? 7 : 0);
          const leftOffset = `calc(${placementIndex} * clamp(35px, 6vw, 60px) + clamp(35px, 6vw, 60px)/1.5)`;

          return (
            <motion.div
              key={note.name}
              className={`key black ${isActive ? 'border-neon-pink shadow-neon-pink' : ''}`}
              style={{
                height: 'clamp(50px, 10vh, 90px)',
                width: 'clamp(20px, 4vw, 40px)',
                left: leftOffset
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{
                scale: 0.95,
                boxShadow: '0 0 15px #FF1E88, 0 0 25px #FF1E88'
              }}
              onMouseDown={() => { const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOn(base, undefined, note.rel); }}
              onMouseUp={() => { const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOff(base, note.rel); }}
              onMouseLeave={() => { if (isActive) { const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOff(base, note.rel); } }}
              onTouchStart={(e) => { e.preventDefault(); const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOn(base, undefined, note.rel); }}
              onTouchEnd={(e) => { e.preventDefault(); const base = baseNotes.find(n => n.name === note.name); if (base) handleNoteOff(base, note.rel); }}
            >
              <span className="absolute bottom-1 text-xs font-bold">
                {note.name}
              </span>
              <span className="absolute top-0.5 left-0.5 text-[9px] opacity-70">{notePrimaryKeyLabel[`${note.name}@${note.rel}`] || ''}</span>
              {isActive && (
                <motion.div
                  className="absolute inset-0 bg-neon-pink opacity-10 rounded-b-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Keyboard legend */}
      <div className="mt-4 text-center text-xs text-neon-blue opacity-70">
        <p className="p-2 glass inline-block rounded-lg">
          Keys: A S D F G H J K L ; ' + W E T Y U O P. Z/X: octave, C/V: velocity ({velocity}). Offset: {octaveOffset}
        </p>
      </div>
    </motion.div>
  );
};

/**
 * Return the index between white keys where black note belongs.
 * For example, C# goes between C(0) and D(1), so index = 0
 */
function getPlacementIndex(noteName) {
  switch (noteName) {
    case 'C#': return 0; // between C and D
    case 'D#': return 1; // between D and E
    case 'F#': return 3; // between F and G
    case 'G#': return 4; // between G and A
    case 'A#': return 5; // between A and B
    default: return 0;
  }
}

export default SynthKeyboard;
