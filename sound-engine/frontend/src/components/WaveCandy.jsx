import React from 'react';
import WaveCandyCanvas from './WaveCandyCanvas.jsx';

// The Raylib/WASM visualizer was retired in favor of the Canvas suite —
// see PROGRESS.md ("retire the Raylib/WASM WaveCandy path") for rationale.
const WaveCandy = () => <WaveCandyCanvas />;

export default React.memo(WaveCandy);
