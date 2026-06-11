import { describe, it, expect } from 'vitest';
import { compileString } from 'klattsch';
import { LOOPBOOK, STARTER_LOOP, getLoopById } from './voiceLoopbook.js';
import { VOICE_BASE_FREQUENCY } from './voicePhrase.js';

const RENDER_OPTS = {
  baseF0: VOICE_BASE_FREQUENCY,
  rate: 120,
  scale: 1.02,
  vibratoDepth: 1.5,
  vibratoRate: 5,
  aspiration: 0.04,
  effort: 0.82
};

describe('voice loopbook corpus', () => {
  it('has a stable set of curated loops', () => {
    expect(LOOPBOOK.length).toBeGreaterThanOrEqual(8);
    const ids = LOOPBOOK.map((loop) => loop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes the first loop as the starter', () => {
    expect(STARTER_LOOP).toBe(LOOPBOOK[0]);
    expect(getLoopById(STARTER_LOOP.id)).toBe(STARTER_LOOP);
  });

  it.each(LOOPBOOK.map((loop) => [loop.id, loop]))(
    'compiles %s with no warnings',
    (_id, loop) => {
      const result = compileString(loop.score, RENDER_OPTS);
      expect(result.warnings).toEqual([]);
    }
  );

  it.each(LOOPBOOK.map((loop) => [loop.id, loop]))(
    'renders %s as a loopable phrase with real melodic range',
    (_id, loop) => {
      const result = compileString(loop.score, RENDER_OPTS);
      // A musical loop, not a one-shot blip or an endless drone.
      expect(result.totalMs).toBeGreaterThan(2500);
      expect(result.totalMs).toBeLessThan(12000);

      // At least 12 sung groups so the line has somewhere to go.
      const groupCount = (loop.score.match(/\(/g) || []).length;
      expect(groupCount).toBeGreaterThanOrEqual(12);

      // The pitch directives must span at least an octave — a flat chant is
      // exactly the failure mode this corpus exists to avoid.
      const notes = [...loop.score.matchAll(/b([A-G][b#]?-?\d+)/g)].map((m) => m[1]);
      const midis = notes.map(noteToMidi).filter((n) => n != null);
      expect(midis.length).toBeGreaterThanOrEqual(groupCount);
      const span = Math.max(...midis) - Math.min(...midis);
      expect(span).toBeGreaterThanOrEqual(12);
    }
  );
});

const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(name) {
  const m = name.match(/^([A-G])([b#]?)(-?\d+)$/);
  if (!m) return null;
  let semi = NOTE_SEMITONES[m[1]];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + semi;
}
