import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../utils/fetchJson.js';
import GeneratedSongStudyPage from './GeneratedSongStudyPage.jsx';

vi.mock('../utils/fetchJson.js', () => ({
  fetchJson: vi.fn()
}));

vi.mock('../hooks/useVisiblePolling.js', () => ({
  useVisiblePolling: vi.fn()
}));

vi.mock('./SongStudyPage.jsx', () => ({
  default: ({ study }) => <div data-testid="generated-player">{study.title}</div>
}));

describe('GeneratedSongStudyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the lightweight status shell while a pipeline job is running', async () => {
    fetchJson.mockResolvedValue({
      id: 'job-running',
      status: 'running',
      song: 'Unfinished cue',
      message: 'Separating stems',
      step: 'separate'
    });

    render(<GeneratedSongStudyPage jobId="job-running" />);

    expect(await screen.findByText('This study is still being built. Keep this page open and it will switch to the player when the merged MIDI is ready.')).toBeInTheDocument();
    expect(screen.queryByTestId('generated-player')).not.toBeInTheDocument();
  });

  it('loads the full player only after a completed job exposes merged MIDI', async () => {
    fetchJson.mockResolvedValue({
      id: 'job-complete',
      status: 'completed',
      song: 'Finished cue',
      artist: 'Test artist',
      artifacts: [{ kind: 'merged-midi', url: '/generated/job-complete.mid' }]
    });

    render(<GeneratedSongStudyPage jobId="job-complete" />);

    expect(await screen.findByTestId('generated-player')).toHaveTextContent('Finished cue');
  });
});
