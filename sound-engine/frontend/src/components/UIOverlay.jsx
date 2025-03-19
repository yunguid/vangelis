import React from 'react';
import { motion } from 'framer-motion';

const waveforms = ["Sine", "Sawtooth", "Square", "Triangle"];

// Map waveform type to blood orange colors
const waveformColors = {
  "Sine": "#FF4500",      // Orange Red
  "Square": "#8B0000",    // Dark Blood Red
  "Sawtooth": "#FF7F50",  // Coral
  "Triangle": "#FF6347"   // Tomato
};

const UIOverlay = ({ currentWaveform, onWaveformChange }) => {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    hover: { 
      scale: 1.05,
      boxShadow: `0 0 15px ${waveformColors[currentWaveform]}`,
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.95 }
  };

  return (
    <motion.div 
      className="glass p-4 rounded-xl backdrop-blur-lg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ boxShadow: '0 0 20px rgba(255, 69, 0, 0.3)' }}
    >
      <motion.h2 
        className="text-lg text-orange-red font-bold mb-4 text-center neon-text"
        animate={{ 
          textShadow: ['0 0 4px rgba(255, 69, 0, 0.8)', '0 0 8px rgba(255, 69, 0, 0.8)', '0 0 4px rgba(255, 69, 0, 0.8)'] 
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Waveform
      </motion.h2>
      
      <div className="grid grid-cols-2 gap-3">
        {waveforms.map(wave => (
          <motion.button
            key={wave}
            className={`px-3 py-2 rounded-lg border-2 text-sm transition-all duration-300 ${
              currentWaveform === wave
                ? 'border-orange-red bg-orange-red bg-opacity-20 text-white shadow-orange-red font-bold'
                : 'border-coral text-coral hover:bg-orange-red hover:bg-opacity-20'
            }`}
            onClick={() => onWaveformChange(wave)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            {wave}
          </motion.button>
        ))}
      </div>
      
      <div className="mt-6">
        <motion.h3 
          className="text-xs text-center font-bold text-coral mb-2"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Current Waveform
        </motion.h3>
        <div className="h-16 flex items-center justify-center">
          <WaveformVisualizer type={currentWaveform} />
        </div>
      </div>
    </motion.div>
  );
};

// Visual representation of the selected waveform
const WaveformVisualizer = ({ type }) => {
  let pathData = "";
  const color = waveformColors[type] || "#FF4500";
  
  // SVG path data for each waveform type
  switch (type) {
    case 'Sine':
      pathData = "M0,20 C5,20 5,10 10,10 C15,10 15,30 20,30 C25,30 25,10 30,10 C35,10 35,30 40,30 C45,30 45,10 50,10 C55,10 55,30 60,30 C65,30 65,10 70,10 C75,10 75,20 80,20";
      break;
    case 'Square':
      pathData = "M0,20 L0,10 L10,10 L10,30 L20,30 L20,10 L30,10 L30,30 L40,30 L40,10 L50,10 L50,30 L60,30 L60,10 L70,10 L70,20";
      break;
    case 'Sawtooth':
      pathData = "M0,20 L10,10 L10,30 L20,10 L20,30 L30,10 L30,30 L40,10 L40,30 L50,10 L50,30 L60,10 L60,30 L70,10 L80,20";
      break;
    case 'Triangle':
      pathData = "M0,20 L10,10 L20,30 L30,10 L40,30 L50,10 L60,30 L70,10 L80,20";
      break;
    default:
      pathData = "M0,20 C5,20 5,10 10,10 C15,10 15,30 20,30 C25,30 25,10 30,10 C35,10 35,30 40,30 C45,30 45,10 50,10 C55,10 55,30 60,30 C65,30 65,10 70,10 C75,10 75,20 80,20";
  }

  // Define animation properties based on waveform type
  const animationVariants = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        duration: type === 'Sine' ?.5 : type === 'Square' ? .4 : type === 'Sawtooth' ? .6 : .5,
        ease: "easeInOut"
      }
    }
  };
  
  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <svg width="160" height="60" viewBox="0 0 80 40" className="drop-shadow-lg">
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial="initial"
          animate="animate"
          variants={animationVariants}
        />
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.1"
          strokeDasharray="0 1"
          animate={{ 
            strokeDashoffset: [0, 10, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </svg>
      
      {/* Add pulsing glow effect */}
      <motion.div 
        className="absolute inset-0 rounded-full blur-xl z-[-1]"
        style={{ backgroundColor: color, opacity: 0.1 }}
        animate={{ 
          opacity: [0.1, 0.2, 0.1],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
      />
    </motion.div>
  );
};

export default UIOverlay; 