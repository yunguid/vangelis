import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { withBase } from '../utils/baseUrl.js';

const RAYLIB_SCRIPT_URL = withBase('raylib/wavecandy.js');
const RAYLIB_WASM_DIR = withBase('raylib/');
const ACTIVE_UPDATE_INTERVAL_MS = 42;
const IDLE_UPDATE_INTERVAL_MS = 200;
const AUDIO_ACTIVITY_HOLD_MS = 320;
const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT = 220;
const RAYLIB_DPR = 1;

let raylibFactoryPromise = null;

const loadRaylibFactory = () => {
  if (raylibFactoryPromise) return raylibFactoryPromise;
  raylibFactoryPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.createWaveCandyModule) {
      resolve(window.createWaveCandyModule);
      return;
    }
    const script = document.createElement('script');
    script.src = RAYLIB_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.createWaveCandyModule) {
        resolve(window.createWaveCandyModule);
      } else {
        reject(new Error('Raylib module factory missing'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load raylib module'));
    document.head.appendChild(script);
  });
  return raylibFactoryPromise;
};

const readTimeDomain = (analyser, floatBuffer, byteBuffer) => {
  if (analyser.getFloatTimeDomainData) {
    analyser.getFloatTimeDomainData(floatBuffer);
    return floatBuffer;
  }
  analyser.getByteTimeDomainData(byteBuffer);
  for (let i = 0; i < byteBuffer.length; i++) {
    floatBuffer[i] = (byteBuffer[i] - 128) / 128;
  }
  return floatBuffer;
};

const resampleFloat = (src, dst) => {
  const srcLen = src.length;
  const dstLen = dst.length;
  if (!srcLen || !dstLen) return;
  if (srcLen === dstLen) {
    dst.set(src);
    return;
  }
  const scale = (srcLen - 1) / (dstLen - 1);
  for (let i = 0; i < dstLen; i++) {
    const pos = i * scale;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = src[idx];
    const b = src[Math.min(idx + 1, srcLen - 1)];
    dst[i] = a + (b - a) * frac;
  }
};

const resampleByteToFloat = (src, dst) => {
  const srcLen = src.length;
  const dstLen = dst.length;
  if (!srcLen || !dstLen) return;
  if (srcLen === dstLen) {
    for (let i = 0; i < dstLen; i++) {
      dst[i] = src[i] / 255;
    }
    return;
  }
  const scale = (srcLen - 1) / (dstLen - 1);
  for (let i = 0; i < dstLen; i++) {
    const pos = i * scale;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = src[idx] / 255;
    const b = src[Math.min(idx + 1, srcLen - 1)] / 255;
    dst[i] = a + (b - a) * frac;
  }
};

const measureViewport = (container) => {
  const rect = container.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.round(container.clientWidth || rect.width || FALLBACK_WIDTH));
  const cssHeight = Math.max(1, Math.round(container.clientHeight || rect.height || FALLBACK_HEIGHT));
  return { cssWidth, cssHeight };
};

const joinClasses = (...values) => values.filter(Boolean).join(' ');

const RaylibWaveCandy = ({
  fallback = null,
  className = 'wave-candy panel elevated wave-candy--raylib',
  viewportClassName = '',
  canvasClassName = '',
  canvasId = 'raylib-wavecandy',
  showToggle = true,
  ariaLabel = 'Wave Candy visualizer',
  children = null
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const moduleRef = useRef(null);
  const pointersRef = useRef(null);
  const viewsRef = useRef(null);
  const modulePausedRef = useRef(false);
  const activityRef = useRef(audioEngine.getActivity());
  const lastActiveAtRef = useRef(activityRef.current.isActive ? Date.now() : 0);
  const buffersRef = useRef({
    freq: null,
    time: null,
    timeByte: null,
    left: null,
    leftByte: null,
    right: null,
    rightByte: null
  });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState(null);
  const [showVector, setShowVector] = useState(false);

  useEffect(() => audioEngine.subscribeActivity((activity) => {
    activityRef.current = activity;
    if (activity.isActive) {
      lastActiveAtRef.current = Date.now();
      const module = moduleRef.current;
      if (modulePausedRef.current && typeof module?.resumeMainLoop === 'function') {
        module.resumeMainLoop();
        modulePausedRef.current = false;
      }
    }
  }), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;

    if (container) {
      const { cssWidth, cssHeight } = measureViewport(container);
      // Keep a 1:1 canvas size path. Raylib + Emscripten handle high-DPI internally,
      // and external DPR scaling here can desynchronize the internal viewport.
      const dpr = RAYLIB_DPR;
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      sizeRef.current = { width: cssWidth, height: cssHeight, dpr };
    }

    loadRaylibFactory()
      .then((factory) => {
        if (cancelled) return null;
        const moduleConfig = {
          canvas,
          locateFile: (path) => `${RAYLIB_WASM_DIR}${path}`,
          onAbort: (msg) => {
            if (cancelled) return;
            const message = msg ? String(msg) : 'Raylib aborted';
            console.error('[RaylibWaveCandy] abort:', message);
            setError(message);
            setFailed(true);
          },
          printErr: (msg) => {
            if (msg) console.error('[RaylibWaveCandy]', msg);
          }
        };
        const moduleOrPromise = factory(moduleConfig);
        if (moduleOrPromise && typeof moduleOrPromise.then === 'function') {
          return moduleOrPromise;
        }
        return Promise.resolve(moduleOrPromise);
      })
      .then((module) => {
        if (!module || cancelled) return;
        if (
          !module._wc_get_wave_ptr ||
          !module._wc_get_left_ptr ||
          !module._wc_get_right_ptr ||
          !module._wc_get_freq_ptr
        ) {
          throw new Error('Raylib module missing WaveCandy exports');
        }
        moduleRef.current = module;
        pointersRef.current = {
          wavePtr: module._wc_get_wave_ptr(),
          leftPtr: module._wc_get_left_ptr(),
          rightPtr: module._wc_get_right_ptr(),
          freqPtr: module._wc_get_freq_ptr(),
          waveLen: module._wc_get_wave_len(),
          leftLen: module._wc_get_left_len(),
          rightLen: module._wc_get_right_len(),
          freqLen: module._wc_get_freq_len()
        };
        if (module._wc_set_show_vector) {
          module._wc_set_show_vector(0);
          if (module._wc_get_show_vector) {
            setShowVector(Boolean(module._wc_get_show_vector()));
          }
        }
        viewsRef.current = null;
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err?.message || String(err || 'Raylib load failed');
        console.error('[RaylibWaveCandy] load failed:', message);
        setError(message);
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || failed || !moduleRef.current) return;
    const module = moduleRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const syncViews = () => {
      const ptrs = pointersRef.current;
      if (!ptrs) return null;
      if (!module.HEAPF32) {
        if (!error) {
          const message = 'Raylib heap is not exposed. Rebuild with HEAPF32 export.';
          console.error('[RaylibWaveCandy] ' + message);
          setError(message);
          setFailed(true);
        }
        return null;
      }
      if (!viewsRef.current || viewsRef.current.buffer !== module.HEAPF32.buffer) {
        viewsRef.current = {
          buffer: module.HEAPF32.buffer,
          wave: new Float32Array(module.HEAPF32.buffer, ptrs.wavePtr, ptrs.waveLen),
          left: new Float32Array(module.HEAPF32.buffer, ptrs.leftPtr, ptrs.leftLen),
          right: new Float32Array(module.HEAPF32.buffer, ptrs.rightPtr, ptrs.rightLen),
          freq: new Float32Array(module.HEAPF32.buffer, ptrs.freqPtr, ptrs.freqLen)
        };
      }
      return viewsRef.current;
    };

    const resize = () => {
      const { cssWidth, cssHeight } = measureViewport(container);
      const dpr = RAYLIB_DPR;
      const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
      const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));
      if (
        sizeRef.current.width !== cssWidth ||
        sizeRef.current.height !== cssHeight ||
        sizeRef.current.dpr !== dpr ||
        canvas.width !== deviceWidth ||
        canvas.height !== deviceHeight
      ) {
        sizeRef.current = { width: cssWidth, height: cssHeight, dpr };
        canvas.width = deviceWidth;
        canvas.height = deviceHeight;
        if (module._wc_set_size) {
          // Raylib layout logic expects CSS pixel dimensions, not device pixels.
          module._wc_set_size(cssWidth, cssHeight);
        }
      }
    };

    let resizeRaf = null;
    const queueResize = () => {
      if (resizeRaf != null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resize();
      });
    };

    const setModulePaused = (shouldPause) => {
      if (modulePausedRef.current === shouldPause) return;
      if (shouldPause) {
        if (typeof module.pauseMainLoop === 'function') {
          module.pauseMainLoop();
        }
        modulePausedRef.current = true;
        return;
      }

      if (typeof module.resumeMainLoop === 'function') {
        module.resumeMainLoop();
      }
      modulePausedRef.current = false;
    };

    queueResize();
    let resizeObserver;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        queueResize();
      }
      const nowMs = Date.now();
      const activityIsHot = activityRef.current?.isActive
        || nowMs - lastActiveAtRef.current < AUDIO_ACTIVITY_HOLD_MS;
      setModulePaused(document.visibilityState !== 'visible' || !activityIsHot);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(queueResize);
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', queueResize);
    window.addEventListener('orientationchange', queueResize);
    window.addEventListener('pageshow', queueResize);
    document.addEventListener('visibilitychange', handleVisibility);
    window.visualViewport?.addEventListener('resize', queueResize);

    let rafId;
    let lastFrame = 0;

    const tick = (time) => {
      rafId = requestAnimationFrame(tick);
      const nowMs = Date.now();
      const activityIsHot = activityRef.current?.isActive
        || nowMs - lastActiveAtRef.current < AUDIO_ACTIVITY_HOLD_MS;
      const hidden = document.visibilityState !== 'visible';
      setModulePaused(hidden || !activityIsHot);

      const frameInterval = activityIsHot ? ACTIVE_UPDATE_INTERVAL_MS : IDLE_UPDATE_INTERVAL_MS;
      if (time - lastFrame < frameInterval) return;
      lastFrame = time;
      if (hidden || !activityIsHot) return;

      const nodes = audioEngine.getAnalysisNodes();
      if (!nodes || !nodes.analyser) return;

      const analyser = nodes.analyser;
      const useStereoData = showVector;
      const leftAnalyser = useStereoData ? (nodes.leftAnalyser || analyser) : null;
      const rightAnalyser = useStereoData ? (nodes.rightAnalyser || analyser) : null;

      if (!buffersRef.current.freq || buffersRef.current.freq.length !== analyser.frequencyBinCount) {
        buffersRef.current.freq = new Uint8Array(analyser.frequencyBinCount);
      }
      if (!buffersRef.current.time || buffersRef.current.time.length !== analyser.fftSize) {
        buffersRef.current.time = new Float32Array(analyser.fftSize);
        buffersRef.current.timeByte = new Uint8Array(analyser.fftSize);
      }
      if (useStereoData && leftAnalyser && rightAnalyser) {
        if (!buffersRef.current.left || buffersRef.current.left.length !== leftAnalyser.fftSize) {
          buffersRef.current.left = new Float32Array(leftAnalyser.fftSize);
          buffersRef.current.leftByte = new Uint8Array(leftAnalyser.fftSize);
        }
        if (!buffersRef.current.right || buffersRef.current.right.length !== rightAnalyser.fftSize) {
          buffersRef.current.right = new Float32Array(rightAnalyser.fftSize);
          buffersRef.current.rightByte = new Uint8Array(rightAnalyser.fftSize);
        }
      }

      analyser.getByteFrequencyData(buffersRef.current.freq);
      const timeData = readTimeDomain(analyser, buffersRef.current.time, buffersRef.current.timeByte);
      let leftData = null;
      let rightData = null;
      if (useStereoData && leftAnalyser && rightAnalyser) {
        leftData = readTimeDomain(leftAnalyser, buffersRef.current.left, buffersRef.current.leftByte);
        rightData = readTimeDomain(rightAnalyser, buffersRef.current.right, buffersRef.current.rightByte);
      }

      const views = syncViews();
      if (!views) return;

      resampleByteToFloat(buffersRef.current.freq, views.freq);
      resampleFloat(timeData, views.wave);
      if (useStereoData && leftData && rightData) {
        resampleFloat(leftData, views.left);
        resampleFloat(rightData, views.right);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (resizeRaf != null) {
        cancelAnimationFrame(resizeRaf);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', queueResize);
      window.removeEventListener('orientationchange', queueResize);
      window.removeEventListener('pageshow', queueResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.visualViewport?.removeEventListener('resize', queueResize);
      setModulePaused(true);
    };
  }, [ready, failed, showVector, error]);

  if (typeof window === 'undefined') {
    return fallback;
  }

  if (failed) {
    return fallback;
  }

  const handleToggle = () => {
    const module = moduleRef.current;
    if (!module || !module._wc_toggle_vector) return;
    module._wc_toggle_vector();
    if (module._wc_get_show_vector) {
      setShowVector(Boolean(module._wc_get_show_vector()));
    }
  };

  return (
    <section
      className={className}
      aria-label={ariaLabel}
      data-raylib-ready={ready ? 'true' : 'false'}
      data-raylib-error={error ? 'true' : 'false'}
    >
      {showToggle && (
        <button
          type="button"
          className="wave-candy-gear"
          onClick={handleToggle}
          disabled={!ready}
          aria-pressed={showVector}
          aria-label="Toggle stereo field"
          title="Toggle stereo field"
        >
          ⚙
        </button>
      )}
      <div ref={containerRef} className={joinClasses('wave-candy__viewport', viewportClassName)}>
        <canvas ref={canvasRef} className={joinClasses('wave-candy__canvas', canvasClassName)} id={canvasId} />
        {children}
      </div>
    </section>
  );
};

export default RaylibWaveCandy;
