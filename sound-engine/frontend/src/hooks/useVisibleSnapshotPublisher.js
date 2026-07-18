import { useCallback, useEffect, useRef } from 'react';

const isVisible = (documentRef) => (
  !documentRef
  || (documentRef.visibilityState
    ? documentRef.visibilityState === 'visible'
    : !documentRef.hidden)
);

export function useVisibleSnapshotPublisher({
  getSnapshot,
  publishSnapshot,
  intervalMs = 40
}) {
  const getSnapshotRef = useRef(getSnapshot);
  const publishSnapshotRef = useRef(publishSnapshot);
  const timeoutRef = useRef(null);
  const dirtyRef = useRef(false);
  const lastPublishRef = useRef(Number.NEGATIVE_INFINITY);
  getSnapshotRef.current = getSnapshot;
  publishSnapshotRef.current = publishSnapshot;

  const commit = useCallback(() => {
    timeoutRef.current = null;
    dirtyRef.current = false;
    lastPublishRef.current = performance.now();
    publishSnapshotRef.current(getSnapshotRef.current());
  }, []);

  const publish = useCallback((immediate = false) => {
    const documentRef = typeof document === 'undefined' ? null : document;
    if (!immediate && !isVisible(documentRef)) {
      dirtyRef.current = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const elapsed = performance.now() - lastPublishRef.current;
    if (immediate || elapsed >= intervalMs) {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      commit();
      return;
    }

    if (timeoutRef.current === null) {
      timeoutRef.current = setTimeout(commit, intervalMs - elapsed);
    }
  }, [commit, intervalMs]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const syncVisibleSnapshot = () => {
      if (isVisible(document) && dirtyRef.current) publish(true);
    };
    document.addEventListener('visibilitychange', syncVisibleSnapshot);
    return () => document.removeEventListener('visibilitychange', syncVisibleSnapshot);
  }, [publish]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
  }, []);

  return publish;
}
