import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MidiBirdsEyeView from './MidiBirdsEyeView.jsx';

describe('MidiBirdsEyeView', () => {
  it('shows an empty-state message when no midi is loaded', () => {
    render(
      <MidiBirdsEyeView
        currentMidi={null}
        progress={0}
        activeNotes={new Set()}
        isPlaying={false}
      />
    );

    expect(screen.getByText('No MIDI loaded')).toBeInTheDocument();
    expect(screen.getByText(/Load a MIDI file to visualize incoming notes/i)).toBeInTheDocument();
  });

  it('shows playback metadata when midi is present', () => {
    render(
      <MidiBirdsEyeView
        currentMidi={{
          name: 'Etude Op. 10',
          duration: 12,
          notes: [{ midi: 60, time: 0, duration: 0.5, velocity: 0.9 }]
        }}
        progress={0.25}
        activeNotes={new Set(['C4'])}
        isPlaying
      />
    );

    expect(screen.getByText('Etude Op. 10')).toBeInTheDocument();
    expect(screen.getByText('Playing')).toBeInTheDocument();
    expect(screen.queryByText(/Load a MIDI file to visualize incoming notes/i)).not.toBeInTheDocument();
  });
});
