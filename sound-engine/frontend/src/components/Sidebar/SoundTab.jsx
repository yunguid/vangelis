import React from 'react';
import UIOverlay from '../UIOverlay.jsx';
import AudioControls from '../AudioControls.jsx';

const SoundTab = ({
  currentWaveform,
  onWaveformChange,
  audioParams,
  onParamChange,
  onParamsChange,
  transportBpm,
  sections,
  onSectionToggle
}) => (
  <div className="sound-tab">
    <UIOverlay
      currentWaveform={currentWaveform}
      onWaveformChange={onWaveformChange}
    />
    <AudioControls
      audioParams={audioParams}
      onParamChange={onParamChange}
      onParamsChange={onParamsChange}
      transportBpm={transportBpm}
      sections={sections}
      onSectionToggle={onSectionToggle}
    />
  </div>
);

export default SoundTab;
