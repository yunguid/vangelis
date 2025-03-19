import React, { useState } from 'react';
import { Donut } from 'react-dial-knob';
import { motion } from 'framer-motion';

const AudioControls = ({ audioParams, onParamChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleKnobChange = (paramName, value) => {
    onParamChange(paramName, value);
  };

  const handleSwitchChange = (paramName) => {
    onParamChange(paramName, !audioParams[paramName]);
  };

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  // Individual knob animation variants
  const knobVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 15 }
    },
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.div 
      className="glass p-4 rounded-xl backdrop-blur-lg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ boxShadow: '0 0 20px rgba(0, 201, 255, 0.3)' }}
    >
      <motion.h2 
        className="text-lg text-neon-blue font-bold mb-4 text-center neon-text"
        animate={{ 
          textShadow: ['0 0 4px rgba(0, 201, 255, 0.8)', '0 0 8px rgba(0, 201, 255, 0.8)', '0 0 4px rgba(0, 201, 255, 0.8)'] 
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Audio Controls
      </motion.h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {/* Volume Knob */}
        <motion.div 
          className="flex flex-col items-center"
          variants={knobVariants}
          whileHover="hover"
        >
          <label className="text-xs text-neon-blue mb-2 font-semibold">Volume</label>
          <div className="relative">
            <Donut 
              diameter={70}
              value={Math.round(audioParams.volume * 100)}
              min={0}
              max={100}
              step={1}
              theme={{
                activeColor: '#00C9FF',
                backgroundColor: 'rgba(45, 11, 89, 0.6)',
                showValue: true,
                valueColor: '#00C9FF',
                textColor: '#FFFFFF'
              }}
              onValueChange={(val) => handleKnobChange('volume', val / 100)}
            />
            <motion.div 
              className="absolute -inset-1 rounded-full opacity-20"
              animate={{ 
                boxShadow: ['0 0 5px #00C9FF', '0 0 15px #00C9FF', '0 0 5px #00C9FF']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="text-xs text-center text-neon-blue mt-2 font-mono">
            {Math.round(audioParams.volume * 100)}%
          </div>
        </motion.div>
        
        {/* Reverb Knob */}
        <motion.div 
          className="flex flex-col items-center"
          variants={knobVariants}
          whileHover="hover"
        >
          <label className="text-xs text-neon-pink mb-2 font-semibold">Reverb</label>
          <div className="relative">
            <Donut 
              diameter={70}
              value={Math.round(audioParams.reverb * 100)}
              min={0}
              max={100}
              step={1}
              theme={{
                activeColor: '#FF1E88',
                backgroundColor: 'rgba(45, 11, 89, 0.6)',
                showValue: true,
                valueColor: '#FF1E88',
                textColor: '#FFFFFF'
              }}
              onValueChange={(val) => handleKnobChange('reverb', val / 100)}
            />
            <motion.div 
              className="absolute -inset-1 rounded-full opacity-20"
              animate={{ 
                boxShadow: ['0 0 5px #FF1E88', '0 0 15px #FF1E88', '0 0 5px #FF1E88']
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            />
          </div>
          <div className="text-xs text-center text-neon-pink mt-2 font-mono">
            {Math.round(audioParams.reverb * 100)}%
          </div>
        </motion.div>
        
        {/* Delay Knob */}
        <motion.div 
          className="flex flex-col items-center"
          variants={knobVariants}
          whileHover="hover"
        >
          <label className="text-xs text-neon-cyan mb-2 font-semibold">Delay</label>
          <div className="relative">
            <Donut 
              diameter={70}
              value={audioParams.delay}
              min={0}
              max={500}
              step={10}
              theme={{
                activeColor: '#0FFCD8',
                backgroundColor: 'rgba(45, 11, 89, 0.6)',
                showValue: true,
                valueColor: '#0FFCD8',
                textColor: '#FFFFFF'
              }}
              onValueChange={(val) => handleKnobChange('delay', val)}
            />
            <motion.div 
              className="absolute -inset-1 rounded-full opacity-20"
              animate={{ 
                boxShadow: ['0 0 5px #0FFCD8', '0 0 15px #0FFCD8', '0 0 5px #0FFCD8']
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            />
          </div>
          <div className="text-xs text-center text-neon-cyan mt-2 font-mono">
            {Math.round(audioParams.delay)} ms
          </div>
        </motion.div>
        
        {/* Distortion Knob */}
        <motion.div 
          className="flex flex-col items-center"
          variants={knobVariants}
          whileHover="hover"
        >
          <label className="text-xs text-white mb-2 font-semibold">Distortion</label>
          <div className="relative">
            <Donut 
              diameter={70}
              value={Math.round(audioParams.distortion * 100)}
              min={0}
              max={100}
              step={1}
              theme={{
                activeColor: '#FFFFFF',
                backgroundColor: 'rgba(45, 11, 89, 0.6)',
                showValue: true,
                valueColor: '#FFFFFF',
                textColor: '#FFFFFF'
              }}
              onValueChange={(val) => handleKnobChange('distortion', val / 100)}
            />
            <motion.div 
              className="absolute -inset-1 rounded-full opacity-20"
              animate={{ 
                boxShadow: ['0 0 5px #FFFFFF', '0 0 15px #FFFFFF', '0 0 5px #FFFFFF']
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
            />
          </div>
          <div className="text-xs text-center text-white mt-2 font-mono">
            {Math.round(audioParams.distortion * 100)}%
          </div>
        </motion.div>
      </div>

      {/* Advanced Mode Toggle */}
      <div className="mt-6 flex justify-center">
        <motion.button
          className={`px-4 py-2 rounded-lg ${showAdvanced ? 'bg-purple-700' : 'bg-deep-purple'} text-white font-medium text-sm`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide Advanced' : 'Show Advanced Features'}
        </motion.button>
      </div>
      
      {/* Advanced Features */}
      {showAdvanced && (
        <motion.div
          className="mt-6 border-t border-purple-700 pt-4"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ADSR Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm text-neon-green font-bold">ADSR Envelope</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={audioParams.useADSR || false}
                    onChange={() => handleSwitchChange('useADSR')}
                  />
                  <div className={`block w-10 h-6 rounded-full ${audioParams.useADSR ? 'bg-neon-green' : 'bg-gray-600'} transition-colors`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${audioParams.useADSR ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-2 text-xs text-white">{audioParams.useADSR ? 'On' : 'Off'}</span>
              </label>
            </div>
            
            {audioParams.useADSR && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Attack */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-green mb-1">Attack</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={Math.round((audioParams.attack || 0.05) * 100)}
                      min={1}
                      max={100}
                      step={1}
                      theme={{
                        activeColor: '#00FF66',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#00FF66',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('attack', val / 100)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {Math.round((audioParams.attack || 0.05) * 100)} ms
                  </div>
                </motion.div>
                
                {/* Decay */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-green mb-1">Decay</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={Math.round((audioParams.decay || 0.1) * 100)}
                      min={1}
                      max={100}
                      step={1}
                      theme={{
                        activeColor: '#00FF66',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#00FF66',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('decay', val / 100)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {Math.round((audioParams.decay || 0.1) * 100)} ms
                  </div>
                </motion.div>
                
                {/* Sustain */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-green mb-1">Sustain</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={Math.round((audioParams.sustain || 0.7) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      theme={{
                        activeColor: '#00FF66',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#00FF66',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('sustain', val / 100)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {Math.round((audioParams.sustain || 0.7) * 100)}%
                  </div>
                </motion.div>
                
                {/* Release */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-green mb-1">Release</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={Math.round((audioParams.release || 0.3) * 100)}
                      min={1}
                      max={200}
                      step={1}
                      theme={{
                        activeColor: '#00FF66',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#00FF66',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('release', val / 100)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {Math.round((audioParams.release || 0.3) * 100)} ms
                  </div>
                </motion.div>
              </div>
            )}
          </div>
          
          {/* FM Synthesis Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm text-neon-purple font-bold">FM Synthesis</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={audioParams.useFM || false}
                    onChange={() => handleSwitchChange('useFM')}
                  />
                  <div className={`block w-10 h-6 rounded-full ${audioParams.useFM ? 'bg-neon-purple' : 'bg-gray-600'} transition-colors`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${audioParams.useFM ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-2 text-xs text-white">{audioParams.useFM ? 'On' : 'Off'}</span>
              </label>
            </div>
            
            {audioParams.useFM && (
              <div className="grid grid-cols-2 gap-4">
                {/* FM Ratio */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-purple mb-1">Ratio</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={(audioParams.fmRatio || 2.5) * 10}
                      min={5}
                      max={80}
                      step={1}
                      theme={{
                        activeColor: '#B413EC',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#B413EC',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('fmRatio', val / 10)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {(audioParams.fmRatio || 2.5).toFixed(1)}
                  </div>
                </motion.div>
                
                {/* FM Index */}
                <motion.div
                  className="flex flex-col items-center"
                  variants={knobVariants}
                >
                  <label className="text-xs text-neon-purple mb-1">Depth</label>
                  <div className="relative">
                    <Donut
                      diameter={60}
                      value={(audioParams.fmIndex || 5)}
                      min={1}
                      max={50}
                      step={1}
                      theme={{
                        activeColor: '#B413EC',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        showValue: true,
                        valueColor: '#B413EC',
                        textColor: '#FFFFFF'
                      }}
                      onValueChange={(val) => handleKnobChange('fmIndex', val)}
                    />
                  </div>
                  <div className="text-xs text-center text-white mt-1">
                    {Math.round(audioParams.fmIndex || 5)}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
          
          {/* Other Controls */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pan */}
            <motion.div
              className="flex flex-col items-center"
              variants={knobVariants}
            >
              <label className="text-xs text-neon-blue mb-1">Pan</label>
              <div className="relative">
                <Donut
                  diameter={60}
                  value={Math.round((audioParams.pan || 0.5) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  theme={{
                    activeColor: '#00C9FF',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    showValue: true,
                    valueColor: '#00C9FF',
                    textColor: '#FFFFFF'
                  }}
                  onValueChange={(val) => handleKnobChange('pan', val / 100)}
                />
              </div>
              <div className="text-xs text-center text-white mt-1">
                {audioParams.pan < 0.5 ? 'L' : audioParams.pan > 0.5 ? 'R' : 'C'} 
                {audioParams.pan !== 0.5 ? Math.abs(Math.round((audioParams.pan - 0.5) * 200)) : ''}
              </div>
            </motion.div>
            
            {/* Phase Offset */}
            <motion.div
              className="flex flex-col items-center"
              variants={knobVariants}
            >
              <label className="text-xs text-neon-orange mb-1">Phase</label>
              <div className="relative">
                <Donut
                  diameter={60}
                  value={Math.round((audioParams.phaseOffset || 0) / (2 * Math.PI) * 360)}
                  min={0}
                  max={360}
                  step={10}
                  theme={{
                    activeColor: '#FF7700',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    showValue: true,
                    valueColor: '#FF7700',
                    textColor: '#FFFFFF'
                  }}
                  onValueChange={(val) => handleKnobChange('phaseOffset', (val / 360) * 2 * Math.PI)}
                />
              </div>
              <div className="text-xs text-center text-white mt-1">
                {Math.round((audioParams.phaseOffset || 0) / (2 * Math.PI) * 360)}°
              </div>
            </motion.div>
          </div>
          
          {/* Performance toggle for parallel processing */}
          <div className="mt-4 flex justify-center">
            <label className="flex items-center cursor-pointer">
              <span className="mr-2 text-xs text-white">High Performance</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={audioParams.useParallel || false}
                  onChange={() => handleSwitchChange('useParallel')}
                />
                <div className={`block w-10 h-6 rounded-full ${audioParams.useParallel ? 'bg-green-500' : 'bg-gray-600'} transition-colors`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${audioParams.useParallel ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AudioControls; 