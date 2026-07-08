import { describe, it, expect } from 'vitest';
import {
  SOUND_DESIGNER_ROUTE,
  isMidiPipelineRoute,
  isSoundDesignerRoute,
  isVoiceLoopRoute,
  MIDI_PIPELINE_ROUTE,
  VOICE_LOOP_ROUTE
} from './routes.js';

describe('isSoundDesignerRoute', () => {
  it('matches the sound designer route', () => {
    expect(isSoundDesignerRoute(SOUND_DESIGNER_ROUTE)).toBe(true);
    expect(isSoundDesignerRoute('/sound-designer')).toBe(true);
  });

  it('matches the sound designer route with a trailing slash', () => {
    expect(isSoundDesignerRoute(`${SOUND_DESIGNER_ROUTE}/`)).toBe(true);
    expect(isSoundDesignerRoute('/sound-designer/')).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isSoundDesignerRoute('/')).toBe(false);
    expect(isSoundDesignerRoute('/pipeline/midi-builder')).toBe(false);
    expect(isSoundDesignerRoute('/voice-loop')).toBe(false);
    expect(isSoundDesignerRoute('/sound-designerz')).toBe(false);
    expect(isSoundDesignerRoute('/studies')).toBe(false);
  });
});

describe('isMidiPipelineRoute', () => {
  it('matches the midi pipeline route, with and without trailing slash', () => {
    expect(isMidiPipelineRoute(MIDI_PIPELINE_ROUTE)).toBe(true);
    expect(isMidiPipelineRoute(`${MIDI_PIPELINE_ROUTE}/`)).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isMidiPipelineRoute('/')).toBe(false);
    expect(isMidiPipelineRoute('/sound-designer')).toBe(false);
  });
});

describe('isVoiceLoopRoute', () => {
  it('matches the voice loop route, with and without trailing slash', () => {
    expect(isVoiceLoopRoute(VOICE_LOOP_ROUTE)).toBe(true);
    expect(isVoiceLoopRoute(`${VOICE_LOOP_ROUTE}/`)).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isVoiceLoopRoute('/')).toBe(false);
    expect(isVoiceLoopRoute('/sound-designer')).toBe(false);
  });
});
