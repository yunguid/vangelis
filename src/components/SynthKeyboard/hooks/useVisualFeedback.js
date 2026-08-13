import { useCallback, useEffect, useRef } from 'react';

export function useVisualFeedback(keyElementsRef) {
  const visualQueueRef = useRef(null);
  if (!visualQueueRef.current) visualQueueRef.current = new Map();
  const visualRafRef = useRef(null);

  useEffect(() => () => {
    if (visualRafRef.current) cancelAnimationFrame(visualRafRef.current);
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

  return {
    scheduleVisualUpdate
  };
}
