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
    <div className="sound-tab__surface">
      <UIOverlay
        currentWaveform={currentWaveform}
        onWaveformChange={onWaveformChange}
        compact
      />
      <AudioControls
        audioParams={audioParams}
        onParamChange={onParamChange}
        onParamsChange={onParamsChange}
        transportBpm={transportBpm}
        sections={sections}
        onSectionToggle={onSectionToggle}
        compact
        embedded
      />
    </div>
  </div>
);

export default SoundTab;
