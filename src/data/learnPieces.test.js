import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { LANDING_PIECES } from './landingQueue.js';
import { LEARN_PIECES, getLearnPieceForPieceId, lessonFromMidi } from './learnPieces.js';

describe('the landing pieces as lessons', () => {
  it('has a lesson for every piece that can open the page, and links to it', () => {
    const opening = LANDING_PIECES.filter((piece) => piece.landing !== false);
    for (const piece of opening) {
      expect(piece.learn, piece.id).toBeTruthy();
      expect(getLearnPieceForPieceId(piece.id)?.slug, piece.id).toBe(piece.learn);
    }
  });

  it.each(LEARN_PIECES.map((piece) => [piece.slug, piece]))('%s reads into phrases, keys and chords', (slug, piece) => {
    const lesson = lessonFromMidi(new Midi(readFileSync(`public/${piece.file}`)), piece);
    expect(lesson.phrases.length).toBeGreaterThan(10);
    expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(4);
    for (const phrase of lesson.phrases) {
      expect(phrase.steps.length).toBeGreaterThan(0);
      expect(phrase.end).toBeGreaterThan(phrase.start);
      for (const step of phrase.steps) {
        for (const note of step.notes) expect(['left', 'right']).toContain(note.hand);
      }
    }
    // Phrases follow one another without overlapping.
    lesson.phrases.slice(1).forEach((phrase, i) => expect(phrase.start).toBeGreaterThanOrEqual(lesson.phrases[i].start));
  });
});
