import React, { useEffect, useRef } from 'react';
import { wavePath, waveX } from './waveDockPath.js';

// Where the current page's control sits on the wave: 44px targets 8px apart,
// centred on its middle (y 220). The other views have no control in the dock.
const NEEDLE_Y = { keyboard: 246, editor: 298 };

// One path draws the wave: an open path is filled as if closed, so the fill runs
// along the wall while the brass stroke stays on the curved rim. The current
// page adds a gauge needle just outside the rim beside its icon.
const rimPath = (needleY, pointerY) => wavePath(pointerY)
  + (needleY ? `M${(waveX(needleY, pointerY) + 3).toFixed(1)} ${needleY}h5` : '');

const ENGRAVING = wavePath(null, 0.86);
const RIVET_YS = [88, 110, 330, 352];

// The dock's wave, drawn in its hover box (the svg's parent) behind the controls.
const DockWave = ({ currentView }) => {
  const svgRef = useRef(null);
  const rimRef = useRef(null);
  const needleY = NEEDLE_Y[currentView];

  // The rim swells under the pointer while it is over the box. The path is set
  // on the node: no render per move.
  useEffect(() => {
    const box = svgRef.current.parentNode;
    const rim = rimRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMove = (event) => {
      if (reducedMotion?.matches) return;
      rim.setAttribute('d', rimPath(needleY, event.clientY - box.getBoundingClientRect().top));
    };
    const onLeave = () => rim.setAttribute('d', rimPath(needleY));
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);
    return () => {
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
    };
  }, [needleY]);

  return (
    <svg className="dock__wave" ref={svgRef} viewBox="0 0 120 440" aria-hidden="true">
      <path className="dock__rim" ref={rimRef} d={rimPath(needleY)} />
      <path className="dock__engraving" d={ENGRAVING} />
      {RIVET_YS.map((y) => (
        <circle key={y} className="dock__rivet" cx={0.86 * waveX(y)} cy={y} r="1.6" />
      ))}
    </svg>
  );
};

export default DockWave;
