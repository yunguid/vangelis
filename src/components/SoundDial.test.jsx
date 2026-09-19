import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SoundDial from './SoundDial.jsx';
import { loadSoundCatalog } from '../utils/soundCatalog.js';
import { saveUserPreset } from '../utils/userPresetStorage.js';

const BANK = vi.hoisted(() => [
  { id: 'waveform-sine', name: 'Sine', category: 'Waveforms', waveformType: 'Sine', audioParams: null },
  { id: 'waveform-saw', name: 'Sawtooth', category: 'Waveforms', waveformType: 'Sawtooth', audioParams: null },
  { id: 'glass', name: 'Glass Bells', category: 'Keys & Bells', waveformType: 'Sine', audioParams: { attack: 0.01 } },
  { id: 'choir', name: 'Bell Choir', category: 'Keys & Bells', waveformType: 'Triangle', audioParams: { attack: 0.2 } },
  { id: 'mine', name: 'My Pad', category: 'Your sounds', waveformType: 'Square', audioParams: { attack: 1 }, removable: true }
]);

vi.mock('../utils/soundCatalog.js', () => ({
  loadSoundCatalog: vi.fn(() => Promise.resolve(BANK))
}));

// As in App: the chosen sound becomes the loaded one and is handed back to the dial.
const Player = ({ onChoose }) => {
  const [loaded, setLoaded] = useState('Sine');
  return (
    <SoundDial
      activeSoundName={loaded}
      onChoose={(sound) => {
        setLoaded(sound.name);
        onChoose(sound);
      }}
    />
  );
};

const openDial = async (onChoose = vi.fn()) => {
  render(<Player onChoose={onChoose} />);
  fireEvent.click(screen.getByRole('button', { name: /choose a sound/i }));
  await act(async () => { await Promise.resolve(); });
  return onChoose;
};

describe('SoundDial', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('points at the loaded sound without reloading it', async () => {
    const onChoose = await openDial();
    expect(screen.getByRole('option', { name: 'Sine' })).toHaveAttribute('aria-selected', 'true');
    act(() => vi.advanceTimersByTime(1000));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('loads a sound once the dial rests on it, not while it turns past', async () => {
    const onChoose = await openDial();
    fireEvent.click(screen.getByRole('button', { name: 'Next sound' }));
    act(() => vi.advanceTimersByTime(50));
    fireEvent.click(screen.getByRole('button', { name: 'Next sound' }));
    act(() => vi.advanceTimersByTime(500));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ name: 'Glass Bells' }));
  });

  it('wraps around from the first sound to the last', async () => {
    const onChoose = await openDial();
    fireEvent.click(screen.getByRole('button', { name: 'Previous sound' }));
    act(() => vi.advanceTimersByTime(500));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Pad' }));
  });

  it('stays on its sound when another is saved while the wheel is wound backwards', async () => {
    const onChoose = await openDial();
    fireEvent.click(screen.getByRole('button', { name: 'Previous sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous sound' }));
    act(() => vi.advanceTimersByTime(500));
    expect(onChoose).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Bell Choir' }));

    // The Sound tab saves a sound: the bank grows by one tick, just after Bell Choir.
    const saved = { id: 'new', name: 'Just Saved', category: 'Your sounds', waveformType: 'Sine', audioParams: {}, removable: true };
    loadSoundCatalog.mockResolvedValueOnce([...BANK.slice(0, 4), saved, BANK[4]]);
    await act(async () => {
      saveUserPreset({ name: 'Just Saved', waveformType: 'Sine', audioParams: {} });
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole('button', { name: /close the sound selector \(bell choir\)/i })).toBeInTheDocument();
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('finds sounds as you type, steps through the matches, and Enter closes it', async () => {
    const onChoose = await openDial();
    const search = screen.getByRole('combobox', { name: 'Find a sound' });
    fireEvent.change(search, { target: { value: 'bell' } });
    expect(screen.getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Glass Bells', 'Bell Choir']);
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    act(() => vi.advanceTimersByTime(500));
    expect(onChoose).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Glass Bells' }));
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /choose a sound \(glass bells\)/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('says so when nothing matches', async () => {
    await openDial();
    fireEvent.change(screen.getByRole('combobox', { name: 'Find a sound' }), { target: { value: 'zzz' } });
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });
});
