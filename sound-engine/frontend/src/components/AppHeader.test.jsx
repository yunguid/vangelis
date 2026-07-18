import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader.jsx';

describe('AppHeader', () => {
  it('renders as a passive brand header when no actions are provided', () => {
    render(<AppHeader activeSection="studies" />);

    expect(screen.getByText('Vangelis')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('delegates controlled sample and recording actions without owning engine state', async () => {
    const onUploadSample = vi.fn().mockResolvedValue(undefined);
    const onClearSample = vi.fn();
    const onToggleRecording = vi.fn();
    const { container, rerender } = render(
      <AppHeader
        activeSection="studio"
        onUploadSample={onUploadSample}
        onClearSample={onClearSample}
        onToggleRecording={onToggleRecording}
        hasCustomSample
        isRecording={false}
        sampleLabel="texture.wav"
      />
    );

    const file = new File(['sample'], 'texture.wav', { type: 'audio/wav' });
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [file] }
    });
    await waitFor(() => expect(onUploadSample).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole('button', { name: 'Clear custom sample' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(onClearSample).toHaveBeenCalledTimes(1);
    expect(onToggleRecording).toHaveBeenCalledTimes(1);

    rerender(
      <AppHeader
        activeSection="studio"
        onUploadSample={onUploadSample}
        onClearSample={onClearSample}
        onToggleRecording={onToggleRecording}
        hasCustomSample
        isRecording
        sampleLabel="texture.wav"
      />
    );
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
  });
});
