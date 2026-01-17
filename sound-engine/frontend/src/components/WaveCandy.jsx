import React from 'react';
import RaylibWaveCandy from './RaylibWaveCandy.jsx';
import WaveCandyCanvas from './WaveCandyCanvas.jsx';

const WaveCandy = () => <RaylibWaveCandy fallback={<WaveCandyCanvas />} />;

export default WaveCandy;
