import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UIOverlay from './UIOverlay';

describe('UIOverlay', () => {
  it('renders waveform heading', () => {
    render(<UIOverlay currentWaveform="Sine" onWaveformChange={() => {}} />);
    expect(screen.getByText('Waveform')).toBeInTheDocument();
  });

  it('displays current waveform', () => {
    render(<UIOverlay currentWaveform="Triangle" onWaveformChange={() => {}} />);
    expect(screen.getAllByText('Triangle').length).toBeGreaterThan(0);
  });

  it('renders all waveform options', () => {
    render(<UIOverlay currentWaveform="Sine" onWaveformChange={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Sine' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sawtooth' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Square' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Triangle' })).toBeInTheDocument();
  });

  it('marks current waveform as active', () => {
    render(<UIOverlay currentWaveform="Square" onWaveformChange={() => {}} />);

    const squareButton = screen.getByRole('radio', { name: 'Square' });
    expect(squareButton).toHaveAttribute('aria-checked', 'true');

    const sineButton = screen.getByRole('radio', { name: 'Sine' });
    expect(sineButton).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onWaveformChange when button clicked', () => {
    const handleChange = vi.fn();
    render(<UIOverlay currentWaveform="Sine" onWaveformChange={handleChange} />);

    const sawtoothButton = screen.getByRole('radio', { name: 'Sawtooth' });
    fireEvent.click(sawtoothButton);

    expect(handleChange).toHaveBeenCalledWith('Sawtooth');
  });

  it('has radiogroup role for accessibility', () => {
    render(<UIOverlay currentWaveform="Sine" onWaveformChange={() => {}} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('omits helper description text', () => {
    render(<UIOverlay currentWaveform="Sine" onWaveformChange={() => {}} />);
    expect(screen.queryByText(/harmonic profile/i)).not.toBeInTheDocument();
  });
});
