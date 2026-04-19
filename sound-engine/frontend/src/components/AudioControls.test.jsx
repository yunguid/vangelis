import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AudioControls from './AudioControls.jsx';

vi.mock('./EffectMacroDial.jsx', () => ({
  default: ({ label, size, compact, disabled }) => (
    <div data-testid={`macro-dial-${label.toLowerCase()}`}>
      {`${label}:${size}:${compact}:${disabled}`}
    </div>
  )
}));

const buildProps = (overrides = {}) => ({
  audioParams: {},
  onParamChange: vi.fn(),
  onParamsChange: vi.fn(),
  transportBpm: 120,
  sections: {
    essentials: false,
    delay: true,
    reverb: true,
    color: false,
    modulation: false
  },
  onSectionToggle: vi.fn(),
  compact: true,
  embedded: true,
  ...overrides
});

describe('AudioControls', () => {
  it('renders compact delay controls with inline header toggles', () => {
    const onParamChange = vi.fn();
    render(<AudioControls {...buildProps({ onParamChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /turn delay on/i }));
    fireEvent.click(screen.getByRole('button', { name: /sync delay to tempo/i }));

    expect(onParamChange).toHaveBeenCalledWith('delayEnabled', true);
    expect(onParamChange).toHaveBeenCalledWith('delaySync', true);
    expect(screen.getByRole('button', { name: /shape repeats/i })).toBeInTheDocument();
  });

  it('passes compact knob sizing through to macro dials', () => {
    render(<AudioControls {...buildProps({ audioParams: { reverbEnabled: true } })} />);

    expect(screen.getByTestId('macro-dial-feedback')).toHaveTextContent('Feedback:88:true:true');
    expect(screen.getByTestId('macro-dial-size')).toHaveTextContent('Size:88:true:false');
  });
});
