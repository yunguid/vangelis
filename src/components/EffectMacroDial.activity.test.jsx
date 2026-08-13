import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EffectMacroDial, { EffectMacroActivityProvider } from './EffectMacroDial.jsx';

const activityHarness = vi.hoisted(() => ({
  listener: null,
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
}));

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    getActivity: () => ({ isActive: false }),
    subscribeActivity: activityHarness.subscribe
  }
}));

const Dial = ({ id }) => (
  <EffectMacroDial
    id={id}
    label={id}
    value={0.25}
    displayValue="25%"
    onChange={() => {}}
  />
);

describe('EffectMacroActivityProvider', () => {
  beforeEach(() => {
    activityHarness.listener = null;
    activityHarness.subscribe.mockReset();
    activityHarness.unsubscribe.mockReset();
    activityHarness.subscribe.mockImplementation((listener) => {
      activityHarness.listener = listener;
      return activityHarness.unsubscribe;
    });
  });

  it('shares one enabled engine subscription across all macro dials', () => {
    const { rerender } = render(
      <EffectMacroActivityProvider enabled>
        <Dial id="feedback" />
        <Dial id="mix" />
        <Dial id="motion" />
      </EffectMacroActivityProvider>
    );

    expect(activityHarness.subscribe).toHaveBeenCalledTimes(1);
    act(() => activityHarness.listener?.({ isActive: true }));
    expect(activityHarness.subscribe).toHaveBeenCalledTimes(1);

    rerender(
      <EffectMacroActivityProvider enabled={false}>
        <Dial id="feedback" />
        <Dial id="mix" />
        <Dial id="motion" />
      </EffectMacroActivityProvider>
    );
    expect(activityHarness.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
