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
  });

  it('renders starter pack quick-access buttons', async () => {
    render(<SamplesTab onSampleSelect={vi.fn()} activeSampleId={null} />);

    expect(screen.queryByText('Starter Pack')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harp High/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /French Horn Low/i })).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: /French Horn Mid/i }));

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
    expect(screen.getByRole('button', { name: /Bassoon Low/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /French Horn Low/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter starter samples')).not.toBeInTheDocument();
  });
});
