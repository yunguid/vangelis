import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { playNote } from '../utils/audio';

const notes = [
  { note: 'C4', frequency: 261.63, label: 'C', isBlack: false },
  { note: 'C#4', frequency: 277.18, label: 'C#', isBlack: true },
  { note: 'D4', frequency: 293.66, label: 'D', isBlack: false },
  { note: 'D#4', frequency: 311.13, label: 'D#', isBlack: true },
  { note: 'E4', frequency: 329.63, label: 'E', isBlack: false },
  { note: 'F4', frequency: 349.23, label: 'F', isBlack: false },
  { note: 'F#4', frequency: 369.99, label: 'F#', isBlack: true },
  { note: 'G4', frequency: 392.00, label: 'G', isBlack: false },
  { note: 'G#4', frequency: 415.30, label: 'G#', isBlack: true },
  { note: 'A4', frequency: 440.00, label: 'A', isBlack: false },
  { note: 'A#4', frequency: 466.16, label: 'A#', isBlack: true },
  { note: 'B4', frequency: 493.88, label: 'B', isBlack: false },
  { note: 'C5', frequency: 523.25, label: 'C', isBlack: false },
];

// Keyboard key to note mapping for computer keyboard control
const keyMap = {
  'a': 'C4', 'w': 'C#4', 's': 'D4', 'e': 'D#4', 'd': 'E4',
  'f': 'F4', 't': 'F#4', 'g': 'G4', 'y': 'G#4', 
  'h': 'A4', 'u': 'A#4', 'j': 'B4', 'k': 'C5'
};

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  const [activeNotes, setActiveNotes] = useState({});
  const [lastAnalyser, setLastAnalyser] = useState(null);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      const noteKey = keyMap[event.key.toLowerCase()];
      if (noteKey && !event.repeat) {
        const noteObj = notes.find(n => n.note === noteKey);
        if (noteObj) {
          handleNoteOn(noteObj);
        }
      }
    };
    
    const handleKeyUp = (event) => {
      const noteKey = keyMap[event.key.toLowerCase()];
      if (noteKey) {
        const noteObj = notes.find(n => n.note === noteKey);
        if (noteObj) {
          handleNoteOff(noteObj);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [waveformType, audioParams, wasmLoaded]);
  
  // Play a note when activated
  const handleNoteOn = (note) => {
    if (!wasmLoaded || activeNotes[note.note]) return;
    
    const result = playNote(note.frequency, 1.0, waveformType, audioParams);
    if (result) {
      const { source, analyser } = result;
      
      setActiveNotes(prev => ({
        ...prev,
        [note.note]: { source, time: Date.now() }
      }));
      
      setLastAnalyser(analyser);
      // Make the analyser globally available for the scene
      window.lastAnalyser = analyser;
    }
  };
  
  // Stop a note when released
  const handleNoteOff = (note) => {
    if (activeNotes[note.note]) {
      const noteData = activeNotes[note.note];
      const timePlayed = Date.now() - noteData.time;
      
      // Ensure a minimum 100ms play time for very quick taps
      if (timePlayed < 100) {
        setTimeout(() => {
          noteData.source.stop();
          setActiveNotes(prev => {
            const newState = { ...prev };
            delete newState[note.note];
            return newState;
          });
        }, 100 - timePlayed);
      } else {
        noteData.source.stop();
        setActiveNotes(prev => {
          const newState = { ...prev };
          delete newState[note.note];
          return newState;
        });
      }
    }
  };
  
  // Render white and black keys separately
  const whiteKeys = notes.filter(note => !note.isBlack);
  const blackKeys = notes.filter(note => note.isBlack);
  
  // Show a message if WASM isn't loaded
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
  
  return (
    <motion.div 
      className="px-4 w-full max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, type: "spring" }}
    >
      <div className="relative flex justify-center">
        {/* White keys */}
        <div className="flex flex-wrap justify-center">
          {whiteKeys.map((note) => (
            <motion.div
              key={note.note}
              className={`key ${activeNotes[note.note] ? 'border-neon-pink shadow-neon-pink' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ 
                scale: 0.95, 
                boxShadow: '0 0 15px #FF1E88, 0 0 25px #FF1E88' 
              }}
              onMouseDown={() => handleNoteOn(note)}
              onMouseUp={() => handleNoteOff(note)}
              onMouseLeave={() => activeNotes[note.note] && handleNoteOff(note)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteOn(note); }}
              onTouchEnd={(e) => { e.preventDefault(); handleNoteOff(note); }}
              style={{
                height: 'clamp(80px, 15vh, 140px)', 
                width: 'clamp(35px, 6vw, 60px)'
              }}
            >
              <span className="absolute bottom-2 font-bold">
                {note.label}
              </span>
              {activeNotes[note.note] && (
                <motion.div 
                  className="absolute inset-0 bg-neon-pink opacity-10 rounded-b-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Black keys (positioned absolutely) */}
        <div className="absolute top-0 flex">
          {blackKeys.map((note) => {
            // Calculate position based on the white keys
            const position = notes.findIndex(n => n.note === note.note);
            const whiteKeyWidth = 'clamp(35px, 6vw, 60px)';
            const blackKeyWidth = 'clamp(20px, 4vw, 40px)';
            
            return (
              <motion.div
                key={note.note}
                className={`key black ${activeNotes[note.note] ? 'border-neon-pink shadow-neon-pink' : ''}`}
                style={{ 
                  left: `calc(${position * 0.5} * ${whiteKeyWidth} - ${blackKeyWidth} / 2)`,
                  width: blackKeyWidth,
                  height: 'clamp(50px, 10vh, 90px)'
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ 
                  scale: 0.95, 
                  boxShadow: '0 0 15px #FF1E88, 0 0 25px #FF1E88' 
                }}
                onMouseDown={() => handleNoteOn(note)}
                onMouseUp={() => handleNoteOff(note)}
                onMouseLeave={() => activeNotes[note.note] && handleNoteOff(note)}
                onTouchStart={(e) => { e.preventDefault(); handleNoteOn(note); }}
                onTouchEnd={(e) => { e.preventDefault(); handleNoteOff(note); }}
              >
                <span className="absolute bottom-2 text-xs">
                  {note.label}
                </span>
                {activeNotes[note.note] && (
                  <motion.div 
                    className="absolute inset-0 bg-neon-pink opacity-10 rounded-b-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Keyboard shortcut legend */}
      <div className="mt-6 text-xs text-center text-neon-blue opacity-70">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1, duration: 1 }}
          className="p-2 glass inline-block rounded-lg"
        >
          Play with your mouse, touch, or keyboard (A-K and W,E,T,Y,U keys)
        </motion.p>
      </div>
    </motion.div>
  );
};

export default SynthKeyboard;
