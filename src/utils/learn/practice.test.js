import { describe, expect, it } from 'vitest';
import { practiceAccuracy, practiceSteps, startPractice, strikeKey } from './practice.js';
import { phraseStanding } from './progress.js';

const phrase = {
  steps: [
    { time: 0, notes: [{ midi: 50, hand: 'left' }, { midi: 66, hand: 'right' }] },
    { time: 1, notes: [{ midi: 69, hand: 'right' }] },
    { time: 2, notes: [{ midi: 45, hand: 'left' }] }
  ]
};

describe('wait-mode practice', () => {
  it('asks one hand for its own notes only', () => {
    expect(practiceSteps(phrase, 'right').map((step) => step.notes.map((note) => note.midi))).toEqual([[66], [69]]);
    expect(practiceSteps(phrase, 'both')).toHaveLength(3);
  });

  it('waits for every note of a step, in any order, then moves on', () => {
    const steps = practiceSteps(phrase, 'both');
    let state = startPractice();
    state = strikeKey(state, steps, 66, { now: 100 });
    expect(state.index).toBe(0);
    state = strikeKey(state, steps, 50, { now: 200 });
    expect(state.index).toBe(1);
    state = strikeKey(state, steps, 69);
    state = strikeKey(state, steps, 45, { now: 900 });
    expect(state.done).toBe(true);
    expect(state.finishedAt - state.startedAt).toBe(800);
    expect(practiceAccuracy(state)).toBe(1);
  });

  it('counts a wrong key without moving on, and flashes it each time', () => {
    const steps = practiceSteps(phrase, 'right');
    let state = strikeKey(startPractice(), steps, 61);
    state = strikeKey(state, steps, 61);
    expect(state.index).toBe(0);
    expect(state.misses).toBe(2);
    expect(state.wrong).toEqual({ midi: 61, serial: 2 });
    state = strikeKey(state, steps, 66);
    expect(state.index).toBe(1);
    expect(practiceAccuracy(state)).toBeCloseTo(1 / 3);
  });

  it('can take the right note in any octave', () => {
    const steps = practiceSteps(phrase, 'right');
    expect(strikeKey(startPractice(), steps, 54).misses).toBe(1);
    expect(strikeKey(startPractice(), steps, 54, { anyOctave: true }).index).toBe(1);
  });
});

describe('progress', () => {
  it('reads how far a phrase has come', () => {
    expect(phraseStanding({}, 0)).toBeNull();
    expect(phraseStanding({ '0:right': 0.5 }, 0)).toBe('started');
    expect(phraseStanding({ '0:left': 0.85 }, 0)).toBe('practising');
    expect(phraseStanding({ '0:both': 0.95 }, 0)).toBe('learned');
  });
});
