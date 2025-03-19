import React, { useState, useEffect, Suspense } from 'react';
import Scene from './components/Scene';
import SynthKeyboard from './components/SynthKeyboard';
import AudioControls from './components/AudioControls';
import UIOverlay from './components/UIOverlay';

// WASM initialization - Fixed import path
import init from './wasm/sound_engine.js';

const App = () => {
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [waveformType, setWaveformType] = useState('Sine');
  const [audioParams, setAudioParams] = useState({
    // Standard controls
    reverb: 0,
    delay: 0,
    distortion: 0,
    volume: 0.7,
    
    // New features
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
    phaseOffset: 0, // no phase offset
    
    // Performance
    useParallel: false
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
    
    // Set up listener for window resize
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
      
      {/* Controls Container - Adaptive for Mobile/Desktop */}
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