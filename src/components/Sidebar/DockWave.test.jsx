import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DockWave from './DockWave.jsx';
import { wavePath } from './waveDockPath.js';

// The wave draws itself in its parent, the dock's hover box.
const renderInBox = (currentView) => {
  const { container } = render(
    <div className="dock__body">
      <DockWave currentView={currentView} />
    </div>
  );
  return { box: container.firstChild, rim: container.querySelector('.dock__rim') };
};

describe('DockWave', () => {
  it('swells the rim under the pointer and settles when the pointer leaves', () => {
    const { box, rim } = renderInBox('studies');
    expect(rim.getAttribute('d')).toBe(wavePath());

    // jsdom has no PointerEvent; a MouseEvent carries clientY the same way.
    box.dispatchEvent(new MouseEvent('pointermove', { clientY: 200 }));
    expect(rim.getAttribute('d')).toBe(wavePath(200));

    box.dispatchEvent(new MouseEvent('pointerleave'));
    expect(rim.getAttribute('d')).toBe(wavePath());
  });

  it("adds a needle beside the current page's control only", () => {
    expect(renderInBox('keyboard').rim.getAttribute('d')).toMatch(/M[\d.]+ 246h5$/);
    expect(renderInBox('editor').rim.getAttribute('d')).toMatch(/M[\d.]+ 298h5$/);
    expect(renderInBox('design').rim.getAttribute('d')).toBe(wavePath());
  });
});
