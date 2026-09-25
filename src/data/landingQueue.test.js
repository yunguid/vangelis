import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/midiParser.js', () => ({
  parseMidiFile: vi.fn(async () => ({
    name: 'fixture',
    duration: 2,
    notes: [
      { midi: 62, time: 0, duration: 1, velocity: 0.7 },
      { midi: 66, time: 1, duration: 1, velocity: 0.7 }
    ]
  }))
}));

import {
  LANDING_PIECES,
  arrangeBuiltInPiece,
  getLandingFiles,
  isLandingEligible,
  loadLandingSelection,
  pickLandingPiece,
  saveLandingSelection
} from './landingQueue.js';

const files = getLandingFiles('/');
const ids = files.filter(isLandingEligible).map((file) => file.id);

describe('landing queue selection', () => {
  beforeEach(() => localStorage.clear());

  it('switches every eligible piece on until the listener chooses', () => {
    expect([...loadLandingSelection(files)]).toEqual(ids);
  });

  it('keeps an empty choice, so the page can open silent', () => {
    saveLandingSelection(new Set());
    expect(loadLandingSelection(files).size).toBe(0);
    expect(pickLandingPiece(files, loadLandingSelection(files), null)).toBeNull();
  });

  it('drops stored ids that are no longer landing pieces and ignores other files', () => {
    localStorage.setItem('vangelis.landingQueue.v1', JSON.stringify([ids[1], 'retired-piece']));
    const library = [...files, { id: 'original-neon-rain', name: 'x', path: '/midi/x.mid' }];
    expect([...loadLandingSelection(library)]).toEqual([ids[1]]);
  });
});

describe('landing queue pick', () => {
  it('never repeats the previous visit while there is another choice', () => {
    const selection = new Set(ids);
    for (let step = 0; step < 50; step++) {
      const picked = pickLandingPiece(files, selection, ids[0], () => step / 50);
      expect(picked.id).not.toBe(ids[0]);
    }
  });

  it('replays the only piece switched on, and can reach every other one', () => {
    expect(pickLandingPiece(files, new Set([ids[0]]), ids[0]).id).toBe(ids[0]);
    const reached = new Set();
    for (let step = 0; step < 50; step++) {
      reached.add(pickLandingPiece(files, new Set(ids), null, () => step / 50).id);
    }
    expect([...reached].sort()).toEqual([...ids].sort());
  });
});

describe('landing pieces', () => {
  it('voices an original through its patch on every note', async () => {
    const original = { id: 'original-pocket-park', path: '/midi/originals/original-pocket-park.mid', landing: { presetId: 'lab-pocket-lead' } };
    const { score, waveformType } = await arrangeBuiltInPiece({}, original);
    expect(waveformType).toBe('Square');
    expect(score.notes).toHaveLength(2);
    for (const note of score.notes) {
      expect(note.waveformType).toBe('Square');
      expect(note.audioParams.squareDuty).toBe(0.25);
    }
  });

  it('keeps a performance switched off for landing in the library, out of the queue', () => {
    const saudade = files.find((file) => file.id === 'performance-saudade-de-triana');
    expect(saudade.instrument).toBe('nylon-guitar');
    expect(isLandingEligible(saudade)).toBe(false);
    localStorage.setItem('vangelis.landingQueue.v1', JSON.stringify([saudade.id, ...ids]));
    expect(loadLandingSelection(files).has(saudade.id)).toBe(false);
    localStorage.clear();
  });

  it('points every piece at a file that ships', async () => {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const midiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'midi');
    for (const piece of LANDING_PIECES) {
      expect(existsSync(path.join(midiDir, piece.relativePath)), piece.relativePath).toBe(true);
    }
  });
});
