import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NowPlaying from './NowPlaying.jsx';
import JourneyDialog from './JourneyDialog.jsx';
import { LANDING_PIECES } from '../data/landingQueue.js';

const renderBar = (props = {}) => {
  const handlers = { onToggle: vi.fn(), onPrevious: vi.fn(), onNext: vi.fn() };
  render(<NowPlaying title="Pernambuco" composer="Luiz Bonfá" journey="pernambuco" isPlaying {...handlers} {...props} />);
  return handlers;
};

describe('now playing', () => {
  it('names the piece and reaches its transport', () => {
    const handlers = renderBar();
    const bar = screen.getByRole('group', { name: 'Now playing' });
    expect(within(bar).getByText('Pernambuco')).toBeInTheDocument();
    expect(within(bar).getByText('Luiz Bonfá')).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: 'Pause' }));
    fireEvent.click(within(bar).getByRole('button', { name: 'Previous piece' }));
    fireEvent.click(within(bar).getByRole('button', { name: 'Next piece' }));
    expect(handlers.onToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onPrevious).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
  });

  it('offers play while stopped, and waits while a chosen piece loads', () => {
    renderBar({ isPlaying: false, isLoading: true });
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('has no journey to open for a piece that was not rebuilt from a record', () => {
    renderBar({ title: 'Subwoofer Lullaby', composer: 'C418', journey: null });
    expect(screen.queryByRole('button', { name: /was rebuilt/ })).not.toBeInTheDocument();
  });

  it('opens how a replica was rebuilt, and gives focus back when Escape closes it', async () => {
    renderBar();
    const opener = screen.getByRole('button', { name: 'How Pernambuco was rebuilt' });
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Pernambuco: the journey' });
    expect(within(dialog).getByText(/Rebuilt by Claude Opus 5\.5 with Luke/)).toBeInTheDocument();
    expect(within(dialog).getByRole('table')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('can open the journey of every piece that names one', async () => {
    for (const piece of LANDING_PIECES.filter((entry) => entry.journey)) {
      const onClose = vi.fn();
      const { unmount } = render(<JourneyDialog journey={piece.journey} onClose={onClose} />);
      expect(await screen.findByRole('dialog', { name: `${piece.name}: the journey` })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });
});
