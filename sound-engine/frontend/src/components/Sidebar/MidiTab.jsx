import React, { useCallback } from 'react';
import MidiPlayer from './MidiPlayer.jsx';
import MidiLibrary from './MidiLibrary.jsx';

/**
 * MIDI transport updates frequently during playback. The catalog is isolated
 * in a memoized child so those progress commits never reconcile its rows.
 */
const MidiTab = ({
  active = true,
  isPlaying,
  isPaused,
  progress,
  currentMidi,
  tempoFactor,
  onPlay,
  onPause,
  onResume,
  onStop,
  onTempoChange
}) => {
  const handlePlayCurrent = useCallback(() => {
    if (currentMidi) onPlay(currentMidi);
  }, [currentMidi, onPlay]);

  return (
    <div className="midi-tab">
      {active ? <div className="midi-tab__section">
        <MidiPlayer
          isPlaying={isPlaying}
          isPaused={isPaused}
          progress={progress}
          currentMidi={currentMidi}
          tempoFactor={tempoFactor}
          onPlay={handlePlayCurrent}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onTempoChange={onTempoChange}
        />
      </div> : null}
      <MidiLibrary active={active} onPlay={onPlay} />
    </div>
  );
};

export default MidiTab;
