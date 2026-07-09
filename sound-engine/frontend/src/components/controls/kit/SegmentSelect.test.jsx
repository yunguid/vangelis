import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import SegmentSelect, { WAVEFORM_GLYPH_NAMES } from './SegmentSelect.jsx';

const WAVE_OPTIONS = [
  { value: 'sine', label: 'Sine', glyph: 'sine' },
  { value: 'square', label: 'Square', glyph: 'square' },
  { value: 'sawtooth', label: 'Saw', glyph: 'sawtooth' },
  { value: 'triangle', label: 'Tri', glyph: 'triangle' }
];

describe('SegmentSelect', () => {
  it('renders a radiogroup with one radio cell per option', () => {
    const { getByRole, getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sine" onChange={vi.fn()} />
    );
    expect(getByRole('radiogroup')).toBeTruthy();
    expect(getAllByRole('radio')).toHaveLength(4);
  });

  it('marks the cell matching value as aria-checked=true, others false', () => {
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="square" onChange={vi.fn()} />
    );
    const cells = getAllByRole('radio');
    expect(cells.map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('clicking a cell calls onChange with its value', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sine" onChange={onChange} />
    );
    fireEvent.click(getAllByRole('radio')[2]);
    expect(onChange).toHaveBeenCalledWith('sawtooth');
  });

  it('clicking the already-active cell does not call onChange again', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sine" onChange={onChange} />
    );
    fireEvent.click(getAllByRole('radio')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ArrowRight moves selection to the next cell (with wraparound)', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="triangle" onChange={onChange} />
    );
    const cells = getAllByRole('radio');
    fireEvent.keyDown(cells[3], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('sine'); // wraps from last to first
  });

  it('ArrowLeft moves selection to the previous cell (with wraparound)', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sine" onChange={onChange} />
    );
    const cells = getAllByRole('radio');
    fireEvent.keyDown(cells[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('triangle'); // wraps from first to last
  });

  it('Home/End jump selection to the first/last cell', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="square" onChange={onChange} />
    );
    const cells = getAllByRole('radio');
    fireEvent.keyDown(cells[1], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('triangle');
    fireEvent.keyDown(cells[1], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('sine');
  });

  it('only the active (or first, if none match) cell is in the tab order', () => {
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sawtooth" onChange={vi.fn()} />
    );
    const cells = getAllByRole('radio');
    expect(cells.map((c) => c.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('a disabled group ignores clicks', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <SegmentSelect id="s1" label="Wave" options={WAVE_OPTIONS} value="sine" onChange={onChange} disabled />
    );
    fireEvent.click(getAllByRole('radio')[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ships exactly the four built-in waveform glyphs', () => {
    expect(WAVEFORM_GLYPH_NAMES.sort()).toEqual(['sawtooth', 'sine', 'square', 'triangle']);
  });

  it('renders a text-only group (no glyph) without error', () => {
    const options = [{ value: 'mono', label: 'Mono' }, { value: 'poly', label: 'Poly' }];
    const { getAllByRole } = render(
      <SegmentSelect id="s2" label="Mode" options={options} value="mono" onChange={vi.fn()} />
    );
    expect(getAllByRole('radio')).toHaveLength(2);
  });
});
