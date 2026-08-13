import React from 'react';
import WaveCandyCanvas from './WaveCandyCanvas.jsx';
import '../styles/wave-candy.css';

// The Raylib/WASM visualizer was retired in favor of the Canvas suite.
const WaveCandy = () => <WaveCandyCanvas />;

export default React.memo(WaveCandy);
