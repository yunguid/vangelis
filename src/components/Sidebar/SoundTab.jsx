import React from 'react';
import UIOverlay from '../UIOverlay.jsx';
import AudioControls from '../AudioControls.jsx';
import '../../styles/controls.css';
import PresetShelf from '../PresetShelf.jsx';

const SoundTab = ({
  currentWaveform,
  onWaveformChange,
  instrument,
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
      {/* Sounds are chosen on the dial at the bottom of the page; shaped ones are saved here. */}
      <PresetShelf
        waveformType={currentWaveform}
        instrument={instrument}
        audioParams={audioParams}
        saveOnly
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
