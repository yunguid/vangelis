import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import GlNotesView from './GlNotesView.jsx';

// A stand-in style that records what the host hands it every frame.
const drawn = vi.hoisted(() => ({ frames: [], resized: 0, disposed: 0 }));
vi.mock('./styles/paperRoll.js', () => ({
  default: {
    id: 'paper',
    create: () => ({
      resize: () => { drawn.resized += 1; },
      render: (frame) => {
        drawn.frames.push({
          songTime: frame.songTime,
          playing: frame.playing,
          jumped: frame.jumped,
          notes: frame.notes.length
        });
      },
      dispose: () => { drawn.disposed += 1; }
    })
  }
}));

// Just what the host itself calls on a context; the style above draws nothing.
const fakeWebGl2 = (canvas) => {
  const noop = () => {};
  return {
    canvas,
    isContextLost: () => false,
    bindFramebuffer: noop,
    bindVertexArray: noop,
    bindBuffer: noop,
    useProgram: noop,
    activeTexture: noop,
    bindTexture: noop,
    disable: noop,
    blendFunc: noop,
    blendEquation: noop,
    clearColor: noop
  };
};

const lastFrame = () => drawn.frames[drawn.frames.length - 1];

describe('GlNotesView', () => {
  let getContext;
  beforeEach(() => {
    drawn.frames.length = 0;
    drawn.resized = 0;
    drawn.disposed = 0;
    getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function getWebGl2(type) {
        return type === 'webgl2' ? fakeWebGl2(this) : null;
      });
    // Browsers hand every animation frame its timestamp.
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(performance.now()), 16));
  });

  afterEach(() => {
    getContext.mockRestore();
    vi.unstubAllGlobals();
  });

  it('draws on the score clock, and flags seeks either way but not playing on', async () => {
    const midi = { duration: 10, notes: [{ midi: 60, time: 1, duration: 1, velocity: 0.8 }] };
    let position = 0.2;
    const readPosition = () => position;
    const props = {
      styleId: 'paper',
      styleName: 'Paper roll',
      currentMidi: midi,
      isPlaying: true,
      getPlaybackProgress: readPosition
    };
    const view = render(<GlNotesView {...props} />);

    await waitFor(() => expect(drawn.frames.length).toBeGreaterThan(0));
    expect(drawn.resized).toBeGreaterThan(0);
    expect(drawn.frames[0]).toMatchObject({ songTime: 2, playing: true, jumped: true, notes: 1 });

    position = 0.21;
    await waitFor(() => expect(lastFrame().songTime).toBeCloseTo(2.1, 5));
    expect(lastFrame().jumped).toBe(false);

    position = 0.8;
    await waitFor(() => expect(lastFrame().songTime).toBeCloseTo(8, 5));
    expect(drawn.frames.find((frame) => frame.songTime === 8).jumped).toBe(true);

    position = 0.5;
    await waitFor(() => expect(lastFrame().songTime).toBeCloseTo(5, 5));
    expect(drawn.frames.find((frame) => frame.songTime === 5).jumped).toBe(true);

    view.rerender(<GlNotesView {...props} isPlaying={false} />);
    await waitFor(() => expect(lastFrame().playing).toBe(false));

    view.unmount();
    expect(drawn.disposed).toBe(1);
  });
});
