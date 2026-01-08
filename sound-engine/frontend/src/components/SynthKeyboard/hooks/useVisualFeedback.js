import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../constants';

export function useVisualFeedback(keyElementsRef) {
  const visualQueueRef = useRef(new Map());
  const visualRafRef = useRef(null);
  const velocityPendingRef = useRef(null);
  const velocityRafRef = useRef(null);

  const [velocityDisplay, setVelocityDisplay] = useState(100);

  useEffect(() => () => {
    if (visualRafRef.current) cancelAnimationFrame(visualRafRef.current);
    if (velocityRafRef.current) cancelAnimationFrame(velocityRafRef.current);
  }, []);

  const scheduleVisualUpdate = useCallback((noteId, isActive) => {
    visualQueueRef.current.set(noteId, isActive);
    if (visualRafRef.current) return;
    visualRafRef.current = requestAnimationFrame(() => {
      visualRafRef.current = null;
      visualQueueRef.current.forEach((active, id) => {
        const element = keyElementsRef.current.get(id);
        if (element) {
          if (active) {
            element.dataset.active = 'true';
          } else {
            delete element.dataset.active;
          }
        }
      });
      visualQueueRef.current.clear();
    });
  }, [keyElementsRef]);

  const updateVelocityDisplay = useCallback((normalizedVelocity) => {
    const midiValue = Math.round(clamp(normalizedVelocity, 0, 1) * 126 + 1);
    velocityPendingRef.current = midiValue;
    if (velocityRafRef.current) return;
    velocityRafRef.current = requestAnimationFrame(() => {
      velocityRafRef.current = null;
      if (velocityPendingRef.current != null) {
        setVelocityDisplay(velocityPendingRef.current);
      }
    });
  }, []);

  return {
    scheduleVisualUpdate,
    updateVelocityDisplay,
    velocityDisplay
  };
}
