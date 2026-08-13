import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SynthKeyboard from './index.jsx';

describe('SynthKeyboard render isolation', () => {
  it('reuses key elements when only audio parameters change', () => {
    const activeNotes = { has: vi.fn(() => false) };
    const { rerender } = render(
      <SynthKeyboard
        waveformType="sine"
        audioParams={{ attack: 0.1 }}
        wasmLoaded
        externalActiveNotes={activeNotes}
      />
    );
    const membershipChecksAfterMount = activeNotes.has.mock.calls.length;
    expect(membershipChecksAfterMount).toBeGreaterThan(0);

    rerender(
      <SynthKeyboard
        waveformType="sine"
        audioParams={{ attack: 0.8 }}
        wasmLoaded
        externalActiveNotes={activeNotes}
      />
    );

    expect(activeNotes.has).toHaveBeenCalledTimes(membershipChecksAfterMount);
  });
});
