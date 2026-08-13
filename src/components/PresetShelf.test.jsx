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

  it('defaults load the full list and retain the Save row for the Sound tab', async () => {
    const { getByRole, findAllByRole, queryByRole } = render(<PresetShelf {...baseProps} />);
    expect(getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(getByRole('textbox', { name: 'New preset name' })).toBeInTheDocument();
    // Not folded: the browse content renders immediately, no disclosure toggle.
    expect(queryByRole('button', { name: /Browse all presets/i })).not.toBeInTheDocument();
    expect((await findAllByRole('list')).length).toBeGreaterThan(0);
  });

  it('foldBrowse collapses and defers the bank behind a disclosure', async () => {
    const { getByRole, findByRole, queryByRole } = render(<PresetShelf {...baseProps} foldBrowse />);
    expect(queryByRole('list')).not.toBeInTheDocument();
    expect(getByRole('button', { name: /^save$/i })).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    expect(await findByRole('list', { name: 'Your presets' })).toBeInTheDocument();
  });

  // F1: hideSave is additive — omitted (default false) leaves every existing
  // caller (the Sound tab) unaffected; true removes only the name-input/Save
  // row, never the browse/load affordances.
  it('hideSave removes only the name-input/Save row, not browsing or loading', async () => {
    const { getByRole, findByRole, queryByRole, queryByLabelText } = render(
      <PresetShelf {...baseProps} foldBrowse hideSave />
    );
    expect(queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    expect(queryByLabelText('New preset name')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    expect(await findByRole('heading', { name: 'Your presets' })).toBeInTheDocument();
    expect(queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  // F2: the revealed browse list carries the `--capped` scroll modifier only
  // when foldBrowse put it behind a disclosure in the first place — the
  // Sound tab's always-open list (no foldBrowse) never gets the modifier, so
  // its layout is untouched.
  it('marks the revealed browse list as capped only when foldBrowse is on', async () => {
    const { container: uncapped, findByRole: findUncappedList } = render(<PresetShelf {...baseProps} />);
    await findUncappedList('list', { name: 'Your presets' });
    expect(uncapped.querySelector('.preset-shelf__browse--capped')).not.toBeInTheDocument();
    expect(uncapped.querySelector('.preset-shelf__browse')).toBeInTheDocument();

    const { container: folded, getByRole, findByRole } = render(<PresetShelf {...baseProps} foldBrowse />);
    expect(folded.querySelector('.preset-shelf__browse')).not.toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: /Browse all presets/i }));
    await findByRole('list', { name: 'Your presets' });
    expect(folded.querySelector('.preset-shelf__browse--capped')).toBeInTheDocument();
  });
});
