const isDocumentVisible = (documentRef) => (
  documentRef.visibilityState
    ? documentRef.visibilityState === 'visible'
    : !documentRef.hidden
);

export const startVisibilityAwareRafLoop = (
  callback,
  {
    documentRef = document,
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame
  } = {}
) => {
  let frameId = null;
  let stopped = false;

  const schedule = () => {
    if (stopped || frameId !== null || !isDocumentVisible(documentRef)) return;
    frameId = requestFrame(runFrame);
  };

  const runFrame = (time) => {
    frameId = null;
    if (stopped || !isDocumentVisible(documentRef)) return;
    callback(time);
    schedule();
  };

  const syncVisibility = () => {
    if (isDocumentVisible(documentRef)) {
      schedule();
      return;
    }
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
  };

  documentRef.addEventListener('visibilitychange', syncVisibility);
  schedule();

  return () => {
    stopped = true;
    documentRef.removeEventListener('visibilitychange', syncVisibility);
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
  };
};
