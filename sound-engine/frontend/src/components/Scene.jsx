import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Effects, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { getFrequencyData } from '../utils/audio';
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette, HueSaturation } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

// Blood orange planet component
const BloodOrangePlanet = ({ position = [15, 0, -20] }) => {
  const planetRef = useRef();
  const atmosphereRef = useRef();
  
  // Planet texture and materials
  const planetMaterial = useMemo(() => {
    // Create gradient texture for the planet
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient (darker core, brighter edge)
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#8B0000');    // Dark blood red core
    gradient.addColorStop(0.5, '#FF4500');  // Orange-red middle
    gradient.addColorStop(0.8, '#FF7F50');  // Coral outer
    gradient.addColorStop(1, '#FF6347');    // Tomato edge
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add noise/texture to the planet
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 1.5 + 0.5;
      
      // Distance from center
      const dx = x - 256;
      const dy = y - 256;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only draw details if within planet radius
      if (distance < 245) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(139, 0, 0, 0.5)' : 'rgba(255, 69, 0, 0.5)';
        ctx.fill();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    
    return new THREE.MeshStandardMaterial({
      map: texture,
      emissive: new THREE.Color('#FF4500'),
      emissiveIntensity: 0.2,
      roughness: 0.7,
      metalness: 0.3,
    });
  }, []);
  
  // Atmosphere material
  const atmosphereMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FF6347'),
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
  }, []);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (planetRef.current) {
      // Slow rotation
      planetRef.current.rotation.y = time * 0.05;
    }
    
    if (atmosphereRef.current) {
      // Slightly faster rotation for atmosphere
      atmosphereRef.current.rotation.y = -time * 0.03;
      
      // Pulsating atmosphere
      const scale = 1.1 + Math.sin(time * 0.2) * 0.01;
      atmosphereRef.current.scale.set(scale, scale, scale);
    }
  });
  
  const planetRadius = 8;
  
  return (
    <group position={position}>
      {/* Main planet */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[planetRadius, 64, 64]} />
        <primitive object={planetMaterial} attach="material" />
      </mesh>
      
      {/* Atmosphere */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[planetRadius * 1.1, 32, 32]} />
        <primitive object={atmosphereMaterial} attach="material" />
      </mesh>
    </group>
  );
};

// Futuristic 3D cubes that react to audio with blood-orange colors
const AudioReactiveCubes = ({ count = 24, analyser }) => {
  const groupRef = useRef();
  const cubeRefs = useRef([]);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(count));
  
  // Initialize cube refs
  if (cubeRefs.current.length !== count) {
    cubeRefs.current = Array(count).fill().map(() => React.createRef());
  }
  
  useFrame(({ clock }) => {
    if (analyser) {
      const data = getFrequencyData(analyser);
      // Sample frequencies to match cube count
      const sampledData = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        const index = Math.floor(i * (data.length / count));
        sampledData[i] = data[index];
      }
      setFrequencyData(sampledData);
    }
    
    // Animate cubes based on audio and time
    const time = clock.getElapsedTime();
    
    cubeRefs.current.forEach((ref, i) => {
      if (!ref.current) return;
      
      // Calculate frequency intensity for this cube
      const freqIntensity = frequencyData[i] ? frequencyData[i] / 255 : 0;
      
      // Calculate radius and angle for circular arrangement
      const radius = 15 + Math.sin(time * 0.2 + i * 0.5) * 1.5; // Breathing circle
      const angle = (i / count) * Math.PI * 2 + time * 0.05;
      
      // Position cubes in a circle
      ref.current.position.x = Math.sin(angle) * radius;
      ref.current.position.z = Math.cos(angle) * radius;
      
      // Audio-reactive height
      const baseHeight = 0.5 + freqIntensity * 4;
      ref.current.scale.y = baseHeight;
      ref.current.position.y = baseHeight / 2 - 2; // Adjust to keep bottom aligned
      
      // Dynamic rotation based on audio intensity and position
      ref.current.rotation.y = time * 0.3 + i * 0.2;
      ref.current.rotation.x = time * 0.2 + freqIntensity * 0.5;
      
      // Update emissive intensity based on audio
      if (ref.current.material) {
        ref.current.material.emissiveIntensity = 0.2 + freqIntensity * 2.5;
        
        // Color shift based on frequency for more visual appeal in red/orange tones
        const hue = 0.05 + (i / count) * 0.05; // Keep in the orange-red range (0.0-0.1 in HSL)
        const saturation = 0.7 + freqIntensity * 0.3;
        const lightness = 0.5 + freqIntensity * 0.2;
        const color = new THREE.Color().setHSL(hue, saturation, lightness);
        ref.current.material.emissive = color;
      }
    });
    
    // Rotate the entire group slowly
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1;
    }
  });
  
  // Generate colors for the cubes in blood orange tones
  const colors = useMemo(() => {
    return Array(count).fill().map((_, i) => {
      // Color in blood orange/red range
      const t = i / count;
      if (t < 0.33) {
        return new THREE.Color('#8B0000'); // Dark blood red
      } else if (t < 0.66) {
        return new THREE.Color('#FF4500'); // Orange red
      } else {
        return new THREE.Color('#FF7F50'); // Coral
      }
    });
  }, [count]);
  
  return (
    <group ref={groupRef}>
      {Array(count).fill().map((_, i) => (
        <mesh key={i} ref={cubeRefs.current[i]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial 
            color={colors[i]} 
            emissive={colors[i]} 
            emissiveIntensity={0.2}
            metalness={0.8}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Floating holographic light pillars with blood orange colors
const LightPillars = ({ count = 16 }) => {
  const pillarsRef = useRef();
  
  // Generate positions and properties for pillars
  const pillarData = useMemo(() => {
    return Array(count).fill().map(() => ({
      position: [
        (Math.random() - 0.5) * 50,
        -2.5 + Math.random() * 0.5,
        (Math.random() - 0.5) * 50 - 5
      ],
      height: Math.random() * 8 + 10,
      thickness: Math.random() * 0.3 + 0.1,
      color: Math.random() < 0.33 
        ? new THREE.Color('#8B0000').multiplyScalar(1.5)  // Dark blood red
        : Math.random() < 0.66 
          ? new THREE.Color('#FF4500').multiplyScalar(1.5)  // Orange red
          : new THREE.Color('#FF7F50').multiplyScalar(1.5), // Coral
      speed: Math.random() * 0.5 + 0.1
    }));
  }, [count]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (pillarsRef.current) {
      pillarsRef.current.children.forEach((pillar, i) => {
        const data = pillarData[i];
        
        // Subtle movement
        pillar.position.y = data.position[1] + Math.sin(time * data.speed) * 0.5;
        
        // Subtle scale pulsing
        pillar.scale.y = data.height * (0.95 + Math.sin(time * data.speed * 0.5) * 0.05);
        
        // Update material
        if (pillar.material) {
          pillar.material.opacity = 0.4 + Math.sin(time * data.speed + i) * 0.2;
        }
      });
    }
  });
  
  return (
    <group ref={pillarsRef}>
      {pillarData.map((data, i) => (
        <mesh key={i} position={data.position}>
          <cylinderGeometry args={[data.thickness, data.thickness, data.height, 8]} />
          <meshBasicMaterial 
            color={data.color}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Upgraded Stars component with red-orange tints
const Stars = () => {
  const count = 1200;
  const starsRef = useRef();
  
  const starPositions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const distance = Math.random() * 30 + 10;
      positions[i * 3] = distance * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 15;
      positions[i * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta) - 5;
      sizes[i] = Math.random() * 1.5 + 0.5;
      
      // Star colors with blood-orange tints
      if (Math.random() < 0.7) {
        // White/slightly warm stars (most common)
        colors[i * 3] = Math.random() * 0.2 + 0.8;     // R (high)
        colors[i * 3 + 1] = Math.random() * 0.3 + 0.7; // G (medium-high)
        colors[i * 3 + 2] = Math.random() * 0.3 + 0.7; // B (medium-high)
      } else if (Math.random() < 0.5) {
        // Orange-red stars
        colors[i * 3] = Math.random() * 0.2 + 0.8;     // R (high)
        colors[i * 3 + 1] = Math.random() * 0.3 + 0.4; // G (medium)
        colors[i * 3 + 2] = Math.random() * 0.2 + 0.1; // B (low)
      } else {
        // Deep red stars
        colors[i * 3] = Math.random() * 0.3 + 0.7;     // R (high)
        colors[i * 3 + 1] = Math.random() * 0.2 + 0.1; // G (low)
        colors[i * 3 + 2] = Math.random() * 0.1 + 0.1; // B (low)
      }
    }
    
    return { positions, sizes, colors };
  }, [count]);
  
  useFrame(({ clock }) => {
    if (starsRef.current) {
      const time = clock.getElapsedTime();
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const frequency = (i % 5) * 0.5 + 0.5;
        const scale = Math.sin(time * frequency + starPositions.positions[i3] * 0.1) * 0.5 + 1.0;
        starsRef.current.geometry.attributes.size.array[i] = starPositions.sizes[i] * scale;
      }
      starsRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });
  
  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={starPositions.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={starPositions.sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={starPositions.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        sizeAttenuation
        transparent
        opacity={0.9}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Enhanced floating particles with blood-orange color scheme
const FloatingParticles = ({ count = 180, audioParams = {}, analyser }) => {
  const particlesRef = useRef();
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(32));
  
  const particleData = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 15 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
      
      // Enhanced varied colors in blood orange range
      const colorType = Math.random();
      if (colorType < 0.33) {
        // Deep red particles
        colors[i * 3] = 0.7 + Math.random() * 0.3;     // R (high)
        colors[i * 3 + 1] = 0.0 + Math.random() * 0.2; // G (low)
        colors[i * 3 + 2] = 0.0 + Math.random() * 0.1; // B (very low)
      } else if (colorType < 0.66) {
        // Blood orange particles
        colors[i * 3] = 0.9 + Math.random() * 0.1;      // R (very high)
        colors[i * 3 + 1] = 0.2 + Math.random() * 0.3;  // G (medium-low)
        colors[i * 3 + 2] = 0.0 + Math.random() * 0.1;  // B (very low)
      } else {
        // Coral/lighter orange particles
        colors[i * 3] = 0.9 + Math.random() * 0.1;      // R (very high)
        colors[i * 3 + 1] = 0.3 + Math.random() * 0.3;  // G (medium)
        colors[i * 3 + 2] = 0.1 + Math.random() * 0.2;  // B (low)
      }
      
      sizes[i] = Math.random() * 1.2 + 0.3;
      speeds[i] = Math.random() * 0.05 + 0.01;
    }
    
    return { positions, colors, sizes, speeds };
  }, [count]);
  
  useFrame(({ clock }) => {
    // Get audio data if analyzer is available
    if (analyser) {
      const data = getFrequencyData(analyser);
      setFrequencyData(data);
    }
    
    const avgFrequency = frequencyData.length 
      ? frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length / 255 
      : 0;
      
    if (particlesRef.current) {
      const time = clock.getElapsedTime();
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Base upward movement
        positions[i3 + 1] += particleData.speeds[i] * (1 + avgFrequency);
        
        // Complex orbital motion
        const angle = time * 0.3 + i * 0.01;
        const radius = 0.02 * Math.sin(time * 0.4 + i * 0.2);
        positions[i3] += Math.sin(angle) * radius * (1 + avgFrequency * 2);
        positions[i3 + 2] += Math.cos(angle) * radius * (1 + avgFrequency * 2);
        
        // Reset when too high with varied positions
        if (positions[i3 + 1] > 15) {
          positions[i3] = (Math.random() - 0.5) * 40;
          positions[i3 + 1] = -2;
          positions[i3 + 2] = (Math.random() - 0.5) * 40 - 5;
        }
      }
      
      // Update particle sizes based on audio
      if (avgFrequency > 0.1) {
        for (let i = 0; i < count; i++) {
          particlesRef.current.geometry.attributes.size.array[i] = 
            particleData.sizes[i] * (1 + avgFrequency * 0.5 * Math.sin(i + time));
        }
        particlesRef.current.geometry.attributes.size.needsUpdate = true;
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particleData.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particleData.colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particleData.sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        sizeAttenuation
        transparent
        vertexColors
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Enhanced post-processing effects tuned for red/orange
const PostProcessingEffects = () => {
  return (
    <EffectComposer>
      <Bloom 
        intensity={1.2} 
        luminanceThreshold={0.2} 
        luminanceSmoothing={0.9} 
      />
      <ChromaticAberration 
        offset={[0.003, 0.003]} 
        blendFunction={BlendFunction.NORMAL}
        opacity={0.4}
      />
      <Noise 
        opacity={0.06} 
        blendFunction={BlendFunction.OVERLAY}
      />
      <Vignette
        eskil={false}
        offset={0.3}
        darkness={0.8}
        blendFunction={BlendFunction.NORMAL}
      />
      <HueSaturation
        hue={0.02}  // Slight shift toward red
        saturation={0.2}
      />
    </EffectComposer>
  );
};

// Responsive camera handling
const ResponsiveCamera = () => {
  const { viewport } = useThree();
  const camera = useThree((state) => state.camera);
  
  useEffect(() => {
    // Adjust camera for small screens
    if (viewport.width < 10) { // smaller devices
      camera.position.z = 8;
      camera.position.y = 3;
      camera.fov = 75;
    } else {
      camera.position.z = 6;
      camera.position.y = 2.5;
      camera.fov = 65;
    }
    camera.updateProjectionMatrix();
  }, [viewport, camera]);
  
  return null;
};

// Main scene content
const SceneContent = ({ audioParams, analyser }) => {
  return (
    <>
      <ResponsiveCamera />
      <ambientLight intensity={0.2} />
      <directionalLight position={[0, 5, 5]} intensity={0.6} color="#FF4500" />
      <Stars />
      <FloatingParticles count={180} audioParams={audioParams} analyser={analyser} />
      <LightPillars count={16} />
      <BloodOrangePlanet />
      <AudioReactiveCubes count={24} analyser={analyser} />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false} 
        rotateSpeed={0.1} 
        autoRotate 
        autoRotateSpeed={0.1}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 3.5}
      />
      <PostProcessingEffects />
    </>
  );
};

// Main exported component
const Scene = ({ audioParams }) => {
  const [analyser, setAnalyser] = useState(null);
  
  // Get the global analyzer if available
  useEffect(() => {
    if (window.lastAnalyser) {
      setAnalyser(window.lastAnalyser);
    }
    
    // Set up analyser checking interval
    const interval = setInterval(() => {
      if (window.lastAnalyser && (!analyser || analyser !== window.lastAnalyser)) {
        setAnalyser(window.lastAnalyser);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [audioParams, analyser]);
  
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
        dpr={[1, 2]} // Responsive pixel ratio for better performance
        style={{ background: 'linear-gradient(to bottom, #000000, #1A0000)' }}
      >
        <SceneContent audioParams={audioParams} analyser={analyser} />
      </Canvas>
    </div>
  );
};

export default Scene;

