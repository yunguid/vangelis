import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BirdsEyeRadar from './BirdsEyeRadar.jsx';

describe('BirdsEyeRadar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes ambient particles once across React renders', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const midi = {
      duration: 12,
      notes: [{ midi: 60, time: 1, duration: 0.5 }]
    };
    const { rerender } = render(
      <BirdsEyeRadar
        currentMidi={midi}
        progress={0}
        activeNotes={new Set()}
        isPlaying
      />
    );

    expect(random).toHaveBeenCalledTimes(32 * 5);

    rerender(
      <BirdsEyeRadar
        currentMidi={midi}
        progress={0.5}
        activeNotes={new Set(['C4'])}
        isPlaying
      />
    );

    expect(random).toHaveBeenCalledTimes(32 * 5);
  });
});
