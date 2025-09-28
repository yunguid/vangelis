import React, { useState, useEffect, Suspense } from 'react';
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
          ${isMobile ? 'inset-0 bg-black/60 backdrop-blur-md p-4 flex flex-col items-center justify-center gap-8' : 'top-0 left-0 right-0 flex justify-between p-4'}
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
      
      {/* Centered Keyboard */}
      <div className="flex-1 z-10 w-full flex justify-center items-center">
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