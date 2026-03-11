import React from 'react';
import RaylibWaveCandy from './RaylibWaveCandy.jsx';
import WaveCandyCanvas from './WaveCandyCanvas.jsx';
import WaveCandyFxDock from './WaveCandyFxDock.jsx';

const WaveCandy = ({
  audioParams,
  onParamChange,
  transportBpm,
  controlSections,
  onSectionToggle
}) => (
  <RaylibWaveCandy fallback={<WaveCandyCanvas />}>
    {audioParams && typeof onParamChange === 'function' && typeof onSectionToggle === 'function' ? (
      <WaveCandyFxDock
        audioParams={audioParams}
        onParamChange={onParamChange}
        transportBpm={transportBpm}
        sections={controlSections}
        onSectionToggle={onSectionToggle}
      />
    ) : null}
  </RaylibWaveCandy>
);

export default WaveCandy;
