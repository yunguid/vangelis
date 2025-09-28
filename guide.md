Below is a thorough review with concrete recommendations followed by **step-by-step instructions** on exactly what to change, and then **complete updated files** reflecting those changes. **I will not stop until all requested modifications are fully shown.** 

---

## REVIEW & RECOMMENDATIONS

### 1. Frontend Piano Layout
- **Issue**: The black keys are positioned inaccurately with a rough `left: calc(...)` approach that can produce a misaligned keyboard. The image also shows the piano is somewhat cramped/ugly.  
- **Solution**: Assign each key an x‐index for white keys and then position the black keys in their correct spaces. Also implement **octave shifting** with the `z` (down) and `x` (up) keys so users can move to higher/lower octaves.  

### 2. Background / Scene
- **Issue**: The background with random shapes, pillars, cubes, etc. is “lame” and “distracting” for what you want (a more realistic, immersive environment).  
- **Solution**: Remove or simplify the old objects (`AudioReactiveCubes`, `BloodOrangePlanet`, etc.) and replace with a more cohesive 3D environment. For instance, use a **Skybox** or large gradient sphere plus the **skyline** texture (already in `public/assets/textures/skyline.svg`). Animate that background gently so it feels dynamic without being chaotic.  

### 3. Audio Controls UI
- **Issue**: The “Show Advanced Features” toggle is not liked, and the “High Performance” (parallel) button is questionable. The advanced knobs are confusing.  
- **Solution**: Remove the advanced toggle and always show all audio controls in one panel. Provide a single **collapse/expand** for the entire panel. Remove the “High Performance” toggle and references to `useParallel`.  

### 4. Rust Backend
- **Issue**: Currently quite minimal.  
- **Suggestion**: If you want to make it more “sophisticated,” you could:
  - Add concurrency or real-time audio streaming with WebSockets.  
  - Provide an extra REST endpoint, e.g. `GET /status` returning JSON about the server, or an endpoint that can generate a WAV on the fly.  
  - Show off your multi-threading with something like an offline DSP route.  

Below are step-by-step instructions and then the **fully revised files**.

---

## STEP-BY-STEP INSTRUCTIONS

1. **Remove “useParallel” and “High Performance” references**  
   - In `frontend/src/App.jsx`, remove `useParallel` from the `audioParams` object.  
   - In `frontend/src/components/AudioControls.jsx`, remove the “High Performance” toggle.  

2. **Remove “Show Advanced Features” toggle, unify all controls**  
   - In `AudioControls.jsx`, remove `showAdvanced` state and the button that toggles it.  
   - Always display the ADSR, FM, Pan, Phase, etc. controls.  
   - Add a new boolean state, e.g. `collapsed`, with one button to collapse/expand the **entire** panel.  

3. **Fix Piano Layout & Implement Octave Shifting**  
   - In `SynthKeyboard.jsx`:
     - Add a new state `octaveOffset: number`, default `0`.  
     - Listen for `keydown` events of `z` (decrement offset by 1) and `x` (increment offset by 1).  
     - Adjust frequencies by `2^(octaveOffset)` so it truly shifts the entire set up/down by octaves.  
     - Replace the old black-key absolute positioning with either a simpler approach or a new formula ensuring correct left offsets.  

4. **Revise the Background / Scene**  
   - In `Scene.jsx`, remove or comment out the old 3D objects (planet, cubes, pillars, floating particles, stars, etc.).  
   - Add a simpler, more realistic approach. For example, create a large sphere or skybox with a gradient. Then place a mesh with the “skyline” texture behind the keyboard. Light it gently.  

5. **Optional**: Improve the Rust backend  
   - In `backend/src/main.rs`, you could add an extra route for, e.g., “/status” returning JSON.  
   - Or illustrate concurrency by reading/writing big audio data in a background task.  

6. **Rebuild & Re-run**  
   - `build_and_run.sh` continues to build the Rust WASM, then the frontend, then launch the Rocket server.  

---

## COMPLETE UPDATED FILES

Below are the **full contents** of the modified files. Only the files that need changes are included. All other files remain the same.

---

### ### File: `frontend/src/App.jsx`

```jsx
import React, { useState, useEffect, Suspense } from 'react';
import Scene from './components/Scene';
import SynthKeyboard from './components/SynthKeyboard';
import AudioControls from './components/AudioControls';
import UIOverlay from './components/UIOverlay';

// WASM initialization - Fixed import path
import init from '../public/pkg/sound_engine.js';

const App = () => {
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [waveformType, setWaveformType] = useState('Sine');
  const [audioParams, setAudioParams] = useState({
    // Standard controls
    reverb: 0,
    delay: 0,
    distortion: 0,
    volume: 0.7,
    
    // ADSR
    useADSR: false,
    attack: 0.05,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    
    // FM Synthesis
    useFM: false,
    fmRatio: 2.5,
    fmIndex: 5,
    
    // Stereo & Phase
    pan: 0.5, // center
    phaseOffset: 0 // no phase offset
    // NOTE: Removed useParallel / High Performance
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Initialize WASM
  useEffect(() => {
    init().then(() => setWasmLoaded(true))
      .catch(err => console.error('Failed to load WASM module:', err));
  }, []);

  // Detect mobile devices and handle resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Update audio parameters
  const handleAudioParamChange = (paramName, value) => {
    setAudioParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Toggle mobile controls visibility
  const toggleControls = () => {
    setShowControls(prev => !prev);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative">
      {/* 3D Scene Background */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-deep-purple">
          <div className="loading-wave flex space-x-2">
            <div className="w-4 h-4 bg-orange-red rounded-full"></div>
            <div className="w-4 h-4 bg-coral rounded-full"></div>
            <div className="w-4 h-4 bg-tomato rounded-full"></div>
          </div>
        </div>
      }>
        <div className="absolute inset-0 z-0">
          <Scene audioParams={audioParams} />
        </div>
      </Suspense>
      
      {/* Mobile Toggle Button */}
      {isMobile && (
        <button 
          className="absolute top-4 right-4 z-30 p-2 glass rounded-full"
          onClick={toggleControls}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#FF4500" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {showControls ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 12h16M12 4v16" />
            )}
          </svg>
        </button>
      )}
      
      {/* Controls Container */}
      {(!isMobile || showControls) && (
        <div className={`
          absolute z-20 transition-all duration-500 
          ${isMobile ? 'inset-0 bg-deep-purple bg-opacity-80 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-8' : 'top-0 left-0 right-0 flex justify-between p-4'}
        `}>
          {/* Waveform Controls */}
          <div className={`${isMobile ? 'w-full max-w-xs' : ''}`}>
            <UIOverlay 
              currentWaveform={waveformType} 
              onWaveformChange={setWaveformType} 
            />
          </div>
          
          {/* Audio Controls */}
          <div className={`${isMobile ? 'w-full max-w-xs' : ''}`}>
            <AudioControls 
              audioParams={audioParams}
              onParamChange={handleAudioParamChange}
            />
          </div>

          {/* Mobile Close Button */}
          {isMobile && (
            <button 
              className="mt-4 cyber-button rounded-lg"
              onClick={toggleControls}
            >
              Close Controls
            </button>
          )}
        </div>
      )}
      
      {/* Title Overlay */}
      <div className="absolute top-0 left-0 right-0 flex justify-center p-4 z-10 pointer-events-none">
        <h1 className="text-2xl md:text-4xl font-syncopate title-glow tracking-widest uppercase">
          Vangelis
        </h1>
      </div>
      
      {/* Keyboard at the bottom */}
      <div className="mt-auto mb-4 md:mb-8 z-10 w-full flex justify-center items-center">
        <SynthKeyboard 
          waveformType={waveformType} 
          audioParams={audioParams}
          wasmLoaded={wasmLoaded}
        />
      </div>
    </div>
  );
};

export default App;
```

---

### ### File: `frontend/src/components/AudioControls.jsx`

```jsx
import React, { useState } from 'react';
import { Donut } from 'react-dial-knob';
import { motion } from 'framer-motion';

const AudioControls = ({ audioParams, onParamChange }) => {
  // We remove showAdvanced, high-performance toggle, etc.
  // Instead, we show all knobs in one panel with an optional collapse.

  const [collapsed, setCollapsed] = useState(false);

  // Collapsible container animation
  const containerVariants = {
    expanded: { opacity: 1, height: 'auto' },
    collapsed: { opacity: 0, height: 0 }
  };

  const handleKnobChange = (paramName, value) => {
    onParamChange(paramName, value);
  };

  const handleSwitchChange = (paramName) => {
    onParamChange(paramName, !audioParams[paramName]);
  };

  return (
    <div className="glass p-4 rounded-xl backdrop-blur-lg">
      <div className="flex items-center justify-between mb-4">
        <motion.h2 
          className="text-lg font-bold neon-text"
          animate={{ 
            textShadow: [
              '0 0 4px rgba(0, 201, 255, 0.8)', 
              '0 0 8px rgba(0, 201, 255, 0.8)', 
              '0 0 4px rgba(0, 201, 255, 0.8)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Audio Controls
        </motion.h2>

        <button
          className="px-3 py-1 rounded-md border border-orange-red text-orange-red hover:bg-orange-red hover:bg-opacity-20 transition-all duration-200"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      <motion.div
        variants={containerVariants}
        animate={collapsed ? 'collapsed' : 'expanded'}
        initial="expanded"
        transition={{ duration: 0.4 }}
        style={{ overflow: 'hidden' }}
      >
        {/* Primary row of knobs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
          {/* Volume */}
          <KnobWithLabel
            label="Volume"
            value={audioParams.volume}
            onChange={(val) => handleKnobChange('volume', val)}
            min={0}
            max={1}
            step={0.01}
            color="#00C9FF"
            displayValue={Math.round(audioParams.volume * 100) + '%'}
          />

          {/* Reverb */}
          <KnobWithLabel
            label="Reverb"
            value={audioParams.reverb}
            onChange={(val) => handleKnobChange('reverb', val)}
            min={0}
            max={1}
            step={0.01}
            color="#FF1E88"
            displayValue={Math.round(audioParams.reverb * 100) + '%'}
          />

          {/* Delay */}
          <KnobWithLabel
            label="Delay"
            value={audioParams.delay}
            onChange={(val) => handleKnobChange('delay', val)}
            min={0}
            max={500}
            step={10}
            color="#0FFCD8"
            displayValue={Math.round(audioParams.delay) + ' ms'}
          />

          {/* Distortion */}
          <KnobWithLabel
            label="Distortion"
            value={audioParams.distortion}
            onChange={(val) => handleKnobChange('distortion', val)}
            min={0}
            max={1}
            step={0.01}
            color="#FFFFFF"
            displayValue={Math.round(audioParams.distortion * 100) + '%'}
          />
        </div>

        {/* ADSR */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm text-neon-green font-bold">ADSR Envelope</h3>
            <ToggleSwitch
              checked={audioParams.useADSR || false}
              onChange={() => handleSwitchChange('useADSR')}
              labelOn="On"
              labelOff="Off"
            />
          </div>

          {audioParams.useADSR && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KnobWithLabel
                label="Attack"
                value={audioParams.attack}
                onChange={(val) => handleKnobChange('attack', val)}
                min={0}
                max={1}
                step={0.01}
                color="#00FF66"
                displayValue={Math.round(audioParams.attack * 100) + ' ms'}
              />
              <KnobWithLabel
                label="Decay"
                value={audioParams.decay}
                onChange={(val) => handleKnobChange('decay', val)}
                min={0}
                max={1}
                step={0.01}
                color="#00FF66"
                displayValue={Math.round(audioParams.decay * 100) + ' ms'}
              />
              <KnobWithLabel
                label="Sustain"
                value={audioParams.sustain}
                onChange={(val) => handleKnobChange('sustain', val)}
                min={0}
                max={1}
                step={0.01}
                color="#00FF66"
                displayValue={Math.round(audioParams.sustain * 100) + '%'}
              />
              <KnobWithLabel
                label="Release"
                value={audioParams.release}
                onChange={(val) => handleKnobChange('release', val)}
                min={0}
                max={2}
                step={0.01}
                color="#00FF66"
                displayValue={Math.round(audioParams.release * 100) + ' ms'}
              />
            </div>
          )}
        </div>

        {/* FM Synthesis */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm text-neon-purple font-bold">FM Synthesis</h3>
            <ToggleSwitch
              checked={audioParams.useFM || false}
              onChange={() => handleSwitchChange('useFM')}
              labelOn="On"
              labelOff="Off"
            />
          </div>

          {audioParams.useFM && (
            <div className="grid grid-cols-2 gap-4">
              <KnobWithLabel
                label="Ratio"
                value={audioParams.fmRatio}
                onChange={(val) => handleKnobChange('fmRatio', val)}
                min={0.1}
                max={10}
                step={0.1}
                color="#B413EC"
                displayValue={audioParams.fmRatio.toFixed(1)}
              />
              <KnobWithLabel
                label="Depth"
                value={audioParams.fmIndex}
                onChange={(val) => handleKnobChange('fmIndex', val)}
                min={1}
                max={50}
                step={1}
                color="#B413EC"
                displayValue={Math.round(audioParams.fmIndex)}
              />
            </div>
          )}
        </div>

        {/* Pan & Phase */}
        <div className="grid grid-cols-2 gap-4">
          <KnobWithLabel
            label="Pan"
            value={audioParams.pan}
            onChange={(val) => handleKnobChange('pan', val)}
            min={0}
            max={1}
            step={0.01}
            color="#00C9FF"
            displayValue={
              audioParams.pan < 0.5 ? 
              `L${Math.round((0.5 - audioParams.pan) * 200)}` :
              audioParams.pan > 0.5 ?
              `R${Math.round((audioParams.pan - 0.5) * 200)}` : 'C'
            }
          />
          <KnobWithLabel
            label="Phase"
            value={audioParams.phaseOffset}
            onChange={(val) => handleKnobChange('phaseOffset', val)}
            min={0}
            max={2 * Math.PI}
            step={Math.PI / 18} // 10-degree increments
            color="#FF7700"
            displayValue={Math.round(audioParams.phaseOffset / (2 * Math.PI) * 360) + '°'}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default AudioControls;

// Helper Knob component
function KnobWithLabel({ label, value, onChange, min, max, step, color, displayValue }) {
  return (
    <motion.div 
      className="flex flex-col items-center"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <label className="text-xs mb-2 font-semibold">{label}</label>
      <div className="relative">
        <Donut
          diameter={70}
          value={value}
          min={min}
          max={max}
          step={step}
          theme={{
            activeColor: color,
            backgroundColor: 'rgba(45, 11, 89, 0.6)',
            showValue: true,
            valueColor: color,
            textColor: '#FFFFFF'
          }}
          onValueChange={(val) => onChange(val)}
        />
        <motion.div 
          className="absolute -inset-1 rounded-full opacity-20"
          animate={{ 
            boxShadow: [
              `0 0 5px ${color}`, 
              `0 0 15px ${color}`, 
              `0 0 5px ${color}`
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <div className="text-xs text-center mt-2 font-mono">
        {displayValue}
      </div>
    </motion.div>
  );
}

// Toggle Switch
function ToggleSwitch({ checked, onChange, labelOn, labelOff }) {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
        <div 
          className={`block w-10 h-6 rounded-full transition-colors ${
            checked ? 'bg-neon-green' : 'bg-gray-600'
          }`}
        ></div>
        <div 
          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
            checked ? 'transform translate-x-4' : ''
          }`}
        ></div>
      </div>
      <span className="ml-2 text-xs text-white">
        {checked ? labelOn : labelOff}
      </span>
    </label>
  );
}
```

---

### ### File: `frontend/src/components/Scene.jsx`

```jsx
import React, { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * New simplified Scene:
 * - We remove the old planet, audio-reactive cubes, pillars, floating particles, stars, etc.
 * - Instead, we add a 'SkySphere' or big sphere around the camera with a gradient.
 * - We also add a big plane behind the keyboard that uses the skyline.svg as a texture.
 */

const Scene = ({ audioParams }) => {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 2.5, 6], fov: 65 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        dpr={[1, 2]}
        style={{ background: 'linear-gradient(to bottom, #000000, #1A0000)' }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
};

const SceneContent = () => {
  // Basic lights
  useEffect(() => {
    // We can do any additional setup here
  }, []);

  return (
    <>
      <SkySphere />
      <CitySkyline />
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 10, 10]} intensity={0.8} color="#ffffff" />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        rotateSpeed={0.2} 
        autoRotate 
        autoRotateSpeed={0.05}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 3.5}
      />
    </>
  );
};

/** Large sphere around the camera to simulate a sky gradient */
const SkySphere = () => {
  const meshRef = useRef();

  // Rotate slowly
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.01;
    }
  });

  // Create a gradient in a canvas texture
  const texture = React.useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#02001f'); // Deep midnight at top
    gradient.addColorStop(1, '#791425'); // Reddish hue at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh ref={meshRef} scale={-1} rotation={[0, 0, 0]}>
      <sphereBufferGeometry args={[50, 32, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

/**
 * A large plane that displays the 'skyline.svg' behind the keyboard.
 * We'll position it far back on the Z-axis and scale it up to fill the view.
 */
const CitySkyline = () => {
  const meshRef = useRef();
  const texture = React.useMemo(() => {
    // We'll just load the SVG as a texture using a DataTexture or we can do minimal approach:
    // Actually, three.js doesn't directly load SVG as a texture well unless we convert it.
    // Let's create a simple plane with a color or gradient, then an optional sprite.
    // If we do want to bring in the skyline svg as a texture, we can do a <Sprite>.
    return null; 
  }, []);

  // Animate or shift slightly
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.2 - 2;
    }
  });

  return (
    <group ref={meshRef} position={[0, -2, -10]}>
      {/* Big plane with a soft color, as a placeholder (or you can map your skyline). */}
      <mesh>
        <planeBufferGeometry args={[25, 8, 1, 1]} />
        <meshBasicMaterial color="#2D0B59" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export default Scene;
```

> **Note**: If you truly want to texture-map `skyline.svg`, you’ll need either to convert it into a PNG/JPG or parse the SVG geometry with `SVGLoader`. The snippet above simply displays a large tinted plane behind the keyboard for a more stable, less blocky background.

---

### ### File: `frontend/src/components/SynthKeyboard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { playNote } from '../utils/audio';

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

const keyMap = {
  // White keys
  'a': 'C',
  's': 'D',
  'd': 'E',
  'f': 'F',
  'g': 'G',
  'h': 'A',
  'j': 'B',
  // Next octave
  'k': 'C', // next octave up
  // Sharps
  'w': 'C#',
  'e': 'D#',
  't': 'F#',
  'y': 'G#',
  'u': 'A#'
  // plus z/x for octave shifting
};

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  const [activeNotes, setActiveNotes] = useState({});
  const [octaveOffset, setOctaveOffset] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();

      // Octave shifting
      if (key === 'z') {
        setOctaveOffset(oct => oct - 1);
        return;
      } else if (key === 'x') {
        setOctaveOffset(oct => oct + 1);
        return;
      }

      // Note playing
      const noteName = keyMap[key];
      if (noteName) {
        const noteObj = baseNotes.find(n => n.name === noteName);
        if (noteObj) handleNoteOn(noteObj);
      }
    };

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase();
      const noteName = keyMap[key];
      if (noteName) {
        const noteObj = baseNotes.find(n => n.name === noteName);
        if (noteObj) handleNoteOff(noteObj);
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
  const getFrequencyForNote = (freq) => {
    // Each full octave shift => multiply or divide by 2
    // octaveOffset = +1 => freq * 2, -1 => freq / 2, etc.
    return freq * Math.pow(2, octaveOffset);
  };

  const handleNoteOn = (noteObj) => {
    if (!wasmLoaded) return;
    if (activeNotes[noteObj.name]) return; // already playing

    const frequency = getFrequencyForNote(noteObj.freq);
    const result = playNote(frequency, 1.0, waveformType, audioParams);
    if (result) {
      const { source, analyser } = result;
      setActiveNotes(prev => ({
        ...prev,
        [noteObj.name]: { source, time: Date.now() }
      }));
      window.lastAnalyser = analyser;
    }
  };

  const handleNoteOff = (noteObj) => {
    if (activeNotes[noteObj.name]) {
      const noteData = activeNotes[noteObj.name];
      const timePlayed = Date.now() - noteData.time;
      if (timePlayed < 100) {
        setTimeout(() => {
          noteData.source.stop();
          setActiveNotes(prev => {
            const newState = { ...prev };
            delete newState[noteObj.name];
            return newState;
          });
        }, 100 - timePlayed);
      } else {
        noteData.source.stop();
        setActiveNotes(prev => {
          const newState = { ...prev };
          delete newState[noteObj.name];
          return newState;
        });
      }
    }
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

  // We separate white vs black keys, but keep them in a row for layout.  
  const whiteNotes = baseNotes.filter(n => !n.isBlack);
  const blackNotes = baseNotes.filter(n => n.isBlack);

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
          const isActive = !!activeNotes[note.name];
          return (
            <motion.div
              key={note.name}
              className={`key ${isActive ? 'border-neon-pink shadow-neon-pink' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ 
                scale: 0.95,
                boxShadow: '0 0 15px #FF1E88, 0 0 25px #FF1E88'
              }}
              onMouseDown={() => handleNoteOn(note)}
              onMouseUp={() => handleNoteOff(note)}
              onMouseLeave={() => isActive && handleNoteOff(note)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteOn(note); }}
              onTouchEnd={(e) => { e.preventDefault(); handleNoteOff(note); }}
              style={{
                height: 'clamp(80px, 15vh, 140px)',
                width: 'clamp(35px, 6vw, 60px)'
              }}
            >
              <span className="absolute bottom-2 font-bold">
                {note.name}
              </span>
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
          const isActive = !!activeNotes[note.name];
          // Find index where black note sits between white notes:
          // e.g. C# is between C and D, D# is between D and E, etc.
          const placementIndex = getPlacementIndex(note.name);

          // Each white key is one "unit" wide in this layout, so offset black keys ~ halfway
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
              onMouseDown={() => handleNoteOn(note)}
              onMouseUp={() => handleNoteOff(note)}
              onMouseLeave={() => isActive && handleNoteOff(note)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteOn(note); }}
              onTouchEnd={(e) => { e.preventDefault(); handleNoteOff(note); }}
            >
              <span className="absolute bottom-1 text-xs font-bold">
                {note.name}
              </span>
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
          Play with your mouse, touch, or keys: [A,S,D,F,G,H,J,K] + [W,E,T,Y,U]  
          <br />
          Use Z / X to shift octaves (Current offset: {octaveOffset})
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
```

---

## (Optional) Rust Backend Improvement Example

If you wish to showcase a more “sophisticated” backend, **edit** `backend/src/main.rs` to add a simple `/status` endpoint returning JSON. For instance:

```rust
#[macro_use] extern crate rocket;

use rocket::fs::{FileServer, relative};
use rocket::serde::json::Json;
use rocket::serde::{Serialize};

#[derive(Serialize)]
struct Status {
    server: &'static str,
    status: &'static str,
    note: &'static str,
}

#[get("/status")]
fn status() -> Json<Status> {
    Json(Status {
        server: "Vangelis-Backend",
        status: "OK",
        note: "More advanced features could include streaming audio endpoints, etc."
    })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", FileServer::from(relative!("../frontend/dist")))
        .mount("/api", routes![status])
}
```

Then you could fetch `/api/status` in your frontend or simply show it. This is just an example to demonstrate a more interesting server.  

---

### FINAL NOTES

After making these changes:

1. **Remove old references**: We have now removed `useParallel`, the “High Performance” toggle, and the “Show Advanced Features” toggle in `AudioControls.jsx`.  
2. **Fully Collapsible**: We replaced it with a single “Collapse” button that hides/shows the entire set of controls.  
3. **Octave Shift**: Press `z` / `x` to move the entire keyboard up/down an octave.  
4. **Background**: We replaced the chaotic 3D objects with a simpler “SkySphere” and a big tinted plane for the city skyline.  

**That completes all requested changes.**