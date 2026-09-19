import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LayerSoundBrowser from './LayerSoundBrowser.jsx';

describe('LayerSoundBrowser', () => {
  it('filters the shared banks and applies a patch to the target layer', async () => {
    const onChoose = vi.fn();
    render(
      <LayerSoundBrowser
        track={{ id: 'track-1', name: 'Lead', instrument: 'Sine' }}
        onChoose={onChoose}
        onClose={() => {}}
      />
    );

    // Banks are visible buttons, not dropdown options, so saved sounds can be found.
    expect(screen.getByRole('button', { name: 'My sounds' })).toBeInTheDocument();
    await screen.findByRole('button', { name: /Widescreen Swell/ });

    fireEvent.click(screen.getByRole('button', { name: 'Patch Lab' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'Cinema Analog' }
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'widescreen' }
    });

    await waitFor(() => expect(screen.getByText('1 sound')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Widescreen Swell/ }));

    expect(onChoose).toHaveBeenCalledWith('track-1', expect.objectContaining({
      id: 'lab-widescreen-swell',
      name: 'Widescreen Swell',
      bank: 'Patch Lab',
      waveformType: 'Sawtooth'
    }));
  });
});
