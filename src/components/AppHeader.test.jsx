import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader.jsx';

describe('AppHeader', () => {
  it('renders as a passive brand header when no actions are provided', () => {
    render(<AppHeader />);
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('exposes only recording and delegates start and stop', () => {
    const onToggleRecording = vi.fn();
    const { rerender } = render(
      <AppHeader onToggleRecording={onToggleRecording} isRecording={false} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(onToggleRecording).toHaveBeenCalledTimes(1);
    rerender(<AppHeader onToggleRecording={onToggleRecording} isRecording />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(onToggleRecording).toHaveBeenCalledTimes(2);
  });
});
