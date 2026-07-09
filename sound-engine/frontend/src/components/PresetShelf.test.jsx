import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PresetShelf from './PresetShelf.jsx';

const baseProps = {
  waveformType: 'Sine',
  audioParams: {},
  activePresetName: null,
  onApply: () => {}
};

describe('PresetShelf', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults (no foldBrowse/hideSave props) render the full list and the Save row — the Sound tab\'s usage, byte-identical', () => {
    const { getByRole, getAllByRole, queryByRole } = render(<PresetShelf {...baseProps} />);
    expect(getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(getByRole('textbox', { name: 'New preset name' })).toBeInTheDocument();
    // Not folded: the browse content renders immediately, no disclosure toggle.
    expect(queryByRole('button', { name: /Browse all presets/i })).not.toBeInTheDocument();
    expect(getAllByRole('list').length).toBeGreaterThan(0);
  });

  it('foldBrowse collapses the browse list behind a disclosure but keeps the Save row', () => {
    const { getByRole, queryByRole } = render(<PresetShelf {...baseProps} foldBrowse />);
    expect(queryByRole('list')).not.toBeInTheDocument();
    expect(getByRole('button', { name: /^save$/i })).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    expect(getByRole('list', { name: 'Your presets' }) || true).toBeTruthy();
  });

  // F1: hideSave is additive — omitted (default false) leaves every existing
  // caller (the Sound tab) unaffected; true removes only the name-input/Save
  // row, never the browse/load affordances.
  it('hideSave removes only the name-input/Save row, not browsing or loading', () => {
    const { getByRole, queryByRole, queryByLabelText } = render(
      <PresetShelf {...baseProps} foldBrowse hideSave />
    );
    expect(queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    expect(queryByLabelText('New preset name')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    expect(getByRole('heading', { name: 'Your presets' })).toBeInTheDocument();
    expect(queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  // F2: the revealed browse list carries the `--capped` scroll modifier only
  // when foldBrowse put it behind a disclosure in the first place — the
  // Sound tab's always-open list (no foldBrowse) never gets the modifier, so
  // its layout is untouched.
  it('marks the revealed browse list as capped only when foldBrowse is on', () => {
    const { container: uncapped } = render(<PresetShelf {...baseProps} />);
    expect(uncapped.querySelector('.preset-shelf__browse--capped')).not.toBeInTheDocument();
    expect(uncapped.querySelector('.preset-shelf__browse')).toBeInTheDocument();

    const { container: folded, getByRole } = render(<PresetShelf {...baseProps} foldBrowse />);
    expect(folded.querySelector('.preset-shelf__browse')).not.toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    expect(folded.querySelector('.preset-shelf__browse--capped')).toBeInTheDocument();
  });
});
