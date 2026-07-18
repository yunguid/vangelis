export const DEFAULT_2D_CANVAS_DPR_CAP = 1.5;

export const getCappedDevicePixelRatio = (
  cap = DEFAULT_2D_CANVAS_DPR_CAP,
  devicePixelRatio = window.devicePixelRatio
) => Math.max(1, Math.min(Number(devicePixelRatio) || 1, cap));

export const createCanvasSizeController = (
  canvas,
  context,
  {
    dprCap = DEFAULT_2D_CANVAS_DPR_CAP,
    windowRef = globalThis.window,
    ResizeObserverClass = globalThis.ResizeObserver
  } = {}
) => {
  const size = { width: 1, height: 1, dpr: 1, resized: true };

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = getCappedDevicePixelRatio(dprCap, windowRef?.devicePixelRatio);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const displayWidth = Math.max(1, Math.round(width * dpr));
    const displayHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight || size.dpr !== dpr) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.resized = true;
    }
    size.width = width;
    size.height = height;
    size.dpr = dpr;
  };

  const resizeObserver = typeof ResizeObserverClass === 'function'
    ? new ResizeObserverClass(measure)
    : null;
  resizeObserver?.observe(canvas);
  windowRef?.addEventListener?.('resize', measure, { passive: true });
  measure();

  return {
    size,
    acknowledgeResize() {
      size.resized = false;
    },
    disconnect() {
      resizeObserver?.disconnect();
      windowRef?.removeEventListener?.('resize', measure);
    }
  };
};
