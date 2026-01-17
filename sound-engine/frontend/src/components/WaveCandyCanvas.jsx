import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createFloatBuffer = (length) => new Float32Array(length);
const createByteBuffer = (length) => new Uint8Array(length);

const syncCanvas = (canvas, ctx, sizeRef) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (sizeRef.width !== width || sizeRef.height !== height || sizeRef.dpr !== dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sizeRef.width = width;
    sizeRef.height = height;
    sizeRef.dpr = dpr;
  }
  return { width, height };
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

const drawSpectrogram = (ctx, canvas, freqData, width, height) => {
  ctx.drawImage(canvas, -1, 0);
  const columnX = width - 1;
  const maxIndex = freqData.length - 1;

  for (let y = 0; y < height; y++) {
    const ratio = y / height;
    const curved = ratio * ratio;
    const index = Math.floor(curved * maxIndex);
    const value = freqData[index] / 255;
    const hue = 260 - value * 220;
    const light = 12 + value * 58;
    ctx.fillStyle = `hsl(${hue}, 88%, ${light}%)`;
    ctx.fillRect(columnX, height - 1 - y, 1, 1);
  }
};

const drawWaveform = (ctx, data, width, height) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(252, 214, 142, 0.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const mid = height / 2;
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * width;
    const y = mid - data[i] * mid * 0.85;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
};

const drawSpectrum = (ctx, freqData, width, height) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(140, 220, 255, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const binCount = freqData.length;
  for (let i = 0; i < binCount; i++) {
    const value = freqData[i] / 255;
    const x = (i / (binCount - 1)) * width;
    const y = height - value * height * 0.9;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
};

const drawGoniometer = (ctx, left, right, width, height) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 128, 92, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 2) {
    const x = (left[i] * 0.45 + 0.5) * width;
    const y = (right[i] * -0.45 + 0.5) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
};

const drawMeter = (ctx, left, right, width, height) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  let sum = 0;
  let peak = 0;
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 2) {
    const sample = (left[i] + right[i]) * 0.5;
    const abs = Math.abs(sample);
    sum += sample * sample;
    if (abs > peak) peak = abs;
  }
  const rms = Math.sqrt(sum / Math.max(1, len));
  const rmsDb = 20 * Math.log10(rms + 1e-6);
  const peakDb = 20 * Math.log10(peak + 1e-6);

  const rmsHeight = clamp((rmsDb + 60) / 60, 0, 1) * height;
  const peakHeight = clamp((peakDb + 60) / 60, 0, 1) * height;

  ctx.fillStyle = 'rgba(255, 126, 90, 0.85)';
  ctx.fillRect(width * 0.25, height - rmsHeight, width * 0.5, rmsHeight);

  ctx.strokeStyle = 'rgba(255, 245, 210, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.2, height - peakHeight);
  ctx.lineTo(width * 0.8, height - peakHeight);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '10px "TX-02-Regular", ui-sans-serif';
  ctx.fillText(`${rmsDb.toFixed(1)} dB`, 4, 12);
};

const WaveCandy = () => {
  const spectrogramRef = useRef(null);
  const scopeRef = useRef(null);
  const spectrumRef = useRef(null);
  const goniometerRef = useRef(null);
  const meterRef = useRef(null);

  const sizesRef = useRef({
    spectrogram: {},
    scope: {},
    spectrum: {},
    goniometer: {},
    meter: {}
  });

  const buffersRef = useRef({
    freq: null,
    time: null,
    timeByte: null,
    left: null,
    leftByte: null,
    right: null,
    rightByte: null
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
      return () => undefined;
    }
    let rafId;
    let lastFrame = 0;

    const render = (time) => {
      rafId = requestAnimationFrame(render);
      if (time - lastFrame < 33) return;
      lastFrame = time;

      const nodes = audioEngine.getAnalysisNodes();
      if (!nodes || !nodes.analyser) return;

      const analyser = nodes.analyser;
      const leftAnalyser = nodes.leftAnalyser || analyser;
      const rightAnalyser = nodes.rightAnalyser || analyser;

      if (!buffersRef.current.freq || buffersRef.current.freq.length !== analyser.frequencyBinCount) {
        buffersRef.current.freq = createByteBuffer(analyser.frequencyBinCount);
      }
      if (!buffersRef.current.time || buffersRef.current.time.length !== analyser.fftSize) {
        buffersRef.current.time = createFloatBuffer(analyser.fftSize);
        buffersRef.current.timeByte = createByteBuffer(analyser.fftSize);
      }
      if (!buffersRef.current.left || buffersRef.current.left.length !== leftAnalyser.fftSize) {
        buffersRef.current.left = createFloatBuffer(leftAnalyser.fftSize);
        buffersRef.current.leftByte = createByteBuffer(leftAnalyser.fftSize);
      }
      if (!buffersRef.current.right || buffersRef.current.right.length !== rightAnalyser.fftSize) {
        buffersRef.current.right = createFloatBuffer(rightAnalyser.fftSize);
        buffersRef.current.rightByte = createByteBuffer(rightAnalyser.fftSize);
      }

      analyser.getByteFrequencyData(buffersRef.current.freq);
      const timeData = readTimeDomain(analyser, buffersRef.current.time, buffersRef.current.timeByte);
      const leftData = readTimeDomain(leftAnalyser, buffersRef.current.left, buffersRef.current.leftByte);
      const rightData = readTimeDomain(rightAnalyser, buffersRef.current.right, buffersRef.current.rightByte);

      const spectrogramCanvas = spectrogramRef.current;
      const scopeCanvas = scopeRef.current;
      const spectrumCanvas = spectrumRef.current;
      const goniometerCanvas = goniometerRef.current;
      const meterCanvas = meterRef.current;

      if (!spectrogramCanvas || !scopeCanvas || !spectrumCanvas || !goniometerCanvas || !meterCanvas) {
        return;
      }

      const spectroCtx = spectrogramCanvas.getContext('2d');
      const scopeCtx = scopeCanvas.getContext('2d');
      const spectrumCtx = spectrumCanvas.getContext('2d');
      const goniometerCtx = goniometerCanvas.getContext('2d');
      const meterCtx = meterCanvas.getContext('2d');

      const spectroSize = syncCanvas(spectrogramCanvas, spectroCtx, sizesRef.current.spectrogram);
      const scopeSize = syncCanvas(scopeCanvas, scopeCtx, sizesRef.current.scope);
      const spectrumSize = syncCanvas(spectrumCanvas, spectrumCtx, sizesRef.current.spectrum);
      const goniometerSize = syncCanvas(goniometerCanvas, goniometerCtx, sizesRef.current.goniometer);
      const meterSize = syncCanvas(meterCanvas, meterCtx, sizesRef.current.meter);

      drawSpectrogram(spectroCtx, spectrogramCanvas, buffersRef.current.freq, spectroSize.width, spectroSize.height);
      drawWaveform(scopeCtx, timeData, scopeSize.width, scopeSize.height);
      drawSpectrum(spectrumCtx, buffersRef.current.freq, spectrumSize.width, spectrumSize.height);
      drawGoniometer(goniometerCtx, leftData, rightData, goniometerSize.width, goniometerSize.height);
      drawMeter(meterCtx, leftData, rightData, meterSize.width, meterSize.height);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="wave-candy panel elevated" aria-label="Wave Candy visualizer">
      <div className="wave-candy-grid">
        <div className="candy-tile">
          <span className="candy-label">Spectrogram</span>
          <canvas ref={spectrogramRef} className="candy-canvas" />
        </div>
        <div className="candy-tile">
          <span className="candy-label">Oscilloscope</span>
          <canvas ref={scopeRef} className="candy-canvas" />
        </div>
        <div className="candy-tile candy-meter">
          <span className="candy-label">Level</span>
          <canvas ref={meterRef} className="candy-canvas" />
        </div>
        <div className="candy-tile">
          <span className="candy-label">Vectorscope</span>
          <canvas ref={goniometerRef} className="candy-canvas" />
        </div>
        <div className="candy-tile">
          <span className="candy-label">Spectrum</span>
          <canvas ref={spectrumRef} className="candy-canvas" />
        </div>
      </div>
    </section>
  );
};

export default WaveCandy;
