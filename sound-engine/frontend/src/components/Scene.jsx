import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
  const texture = useMemo(() => {
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
      <sphereGeometry args={[50, 32, 32]} />
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
        <planeGeometry args={[25, 8, 1, 1]} />
        <meshBasicMaterial color="#2D0B59" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export default Scene;
