import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SamplesTab from './SamplesTab.jsx';

vi.mock('../../utils/sampleStorage.js', () => ({
  getSamplesByCategory: vi.fn(async () => ({})),
  getSample: vi.fn(async () => null),
  storeSample: vi.fn(async () => ({})),
  deleteCategory: vi.fn(async () => {}),
  getStorageStats: vi.fn(async () => ({ count: 0, totalSizeMB: '0.00' }))
}));

describe('SamplesTab starter pack integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: {
        get: () => 'application/json'
      }
    })));
  });

  it('renders starter pack quick-access buttons', async () => {
    render(<SamplesTab onSampleSelect={vi.fn()} activeSampleId={null} />);

    expect(screen.queryByText('Starter Pack')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Concert Grand Air/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /French Horn Round/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No samples yet/i)).toBeInTheDocument();
    });
  });

  it('forwards built-in starter sample metadata when selected', async () => {
    const onSampleSelect = vi.fn();
    render(<SamplesTab onSampleSelect={onSampleSelect} activeSampleId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/No samples yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /French Horn Burnished/i }));

    expect(onSampleSelect).toHaveBeenCalledTimes(1);
    expect(onSampleSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^starter-/),
      sourceUrl: expect.stringContaining('samples/starter-pack/'),
      mimeType: 'audio/wav'
    }));
  });

  it('filters starter quick-access list by family', async () => {
    render(<SamplesTab onSampleSelect={vi.fn()} activeSampleId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/No samples yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^reed$/i }));
    expect(screen.getByRole('button', { name: /Bassoon Grain/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /French Horn Round/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter starter samples')).not.toBeInTheDocument();
  });

  it('surfaces private local starter sounds when a private manifest exists', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({
        soundSets: [
          {
            id: 'ableton-private-starter',
            instruments: [
              {
                id: 'ableton-phantasm',
                label: 'Ableton Phantasm',
                families: ['synth'],
                samplePath: 'private-library/ableton-grand-piano/phantasm-c4.wav',
                baseNote: 'C4'
              }
            ]
          }
        ]
      })
    });

    const onSampleSelect = vi.fn();
    render(<SamplesTab onSampleSelect={onSampleSelect} activeSampleId={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ableton Phantasm/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ableton Phantasm/i }));

    expect(onSampleSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'starter-ableton-private-starter-ableton-phantasm',
      sourceUrl: expect.stringContaining('samples/private-library/'),
      mimeType: 'audio/wav'
    }));
  });
});
