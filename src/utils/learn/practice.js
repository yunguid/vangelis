/**
 * Wait-mode practice: the lesson waits on each step until every one of its notes has been
 * struck (in any order, held or not), then moves on. A key that is not in the step is a miss
 * and is shown, but never blocks. Pure, so the page's reducer and the tests share it.
 */

/** The steps a phrase asks of the chosen hands ('left', 'right' or 'both'), empty steps dropped. */
export const practiceSteps = (phrase, hands = 'both') => (phrase?.steps || [])
  .map((step) => ({
    time: step.time,
    measure: step.measure,
    notes: hands === 'both' ? step.notes : step.notes.filter((note) => note.hand === hands)
  }))
  .filter((step) => step.notes.length > 0);

export const startPractice = () => ({
  index: 0,
  struck: [],
  correct: 0,
  misses: 0,
  wrong: null,
  done: false,
  startedAt: null,
  finishedAt: null
});

const matchTarget = (targets, midi, anyOctave) => (anyOctave
  ? targets.find((target) => (target - midi) % 12 === 0)
  : targets.find((target) => target === midi));

/**
 * A key struck during practice. `wrong` carries a serial so the same wrong key struck twice
 * still flashes twice.
 */
export const strikeKey = (state, steps, midi, { anyOctave = false, now = 0 } = {}) => {
  if (state.done || steps.length === 0) return state;
  const targets = steps[state.index].notes.map((note) => note.midi);
  const startedAt = state.startedAt ?? now;
  const target = matchTarget(targets, midi, anyOctave);
  if (target === undefined) {
    return { ...state, startedAt, misses: state.misses + 1, wrong: { midi, serial: (state.wrong?.serial || 0) + 1 } };
  }
  if (state.struck.includes(target)) return { ...state, startedAt };
  const struck = [...state.struck, target];
  const correct = state.correct + 1;
  if (!targets.every((note) => struck.includes(note))) return { ...state, startedAt, struck, correct };
  const index = state.index + 1;
  const done = index >= steps.length;
  return { ...state, startedAt, struck: [], correct, index: done ? state.index : index, done, finishedAt: done ? now : null };
};

/** Share of strikes that were right, 0-1 (1 before anything is struck). */
export const practiceAccuracy = (state) => {
  const total = state.correct + state.misses;
  return total === 0 ? 1 : state.correct / total;
};
