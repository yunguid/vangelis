import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine.js';

// Audio-reactive WebGL2 background.
// Falls back to the static gradient (the underlay div) when WebGL2 is
// unavailable, the user prefers reduced motion, or the GL context is lost.

const VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main() { gl_Position = vec4(POS[gl_VertexID], 0., 1.); }
`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uBass;   // 0..1 smoothed band energies
uniform float uMid;
uniform float uHigh;
uniform float uLevel;  // overall loudness 0..1

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1., 0.));
  float c = hash(i + vec2(0., 1.));
  float d = hash(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(13.7, 7.1);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

  float t = uTime * 0.04;

  // Domain-warped aurora bands; bass pushes the warp, mids speed the drift
  vec2 warp = vec2(
    fbm(p * 1.4 + vec2(t, -t * 0.7)),
    fbm(p * 1.4 + vec2(-t * 0.8, t * 0.6) + 5.0)
  );
  float w = 0.6 + uBass * 1.2;
  float field = fbm(p * 1.1 + warp * w + vec2(0.0, t * (0.5 + uMid)));

  // Gruvbox palette: charcoal base -> ember orange mids -> aqua highs
  vec3 base = vec3(0.085, 0.09, 0.085);
  vec3 ember = vec3(0.55, 0.28, 0.06);
  vec3 aqua = vec3(0.18, 0.34, 0.24);

  float glow = smoothstep(0.35, 0.95, field);
  vec3 col = base;
  col += ember * glow * (0.22 + uBass * 0.85);
  col += aqua * smoothstep(0.55, 1.0, field) * (0.18 + uHigh * 1.0);

  // Loudness lifts the whole scene slightly
  col *= 0.85 + uLevel * 0.5;

  // Horizon gradient + vignette to keep the UI readable
  col *= mix(1.0, 0.55, uv.y);
  float vig = 1.0 - 0.45 * dot(p * 0.62, p * 0.62);
  col *= clamp(vig, 0.0, 1.0);

  outColor = vec4(col, 1.0);
}
`;

function compileProgram(gl) {
  const make = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${info}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, make(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, make(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

// Average byte-frequency bins between two frequencies, normalized 0..1
function bandEnergy(data, sampleRate, fftSize, lowHz, highHz) {
  const hzPerBin = sampleRate / fftSize;
  const lo = Math.max(0, Math.floor(lowHz / hzPerBin));
  const hi = Math.min(data.length - 1, Math.ceil(highHz / hzPerBin));
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += data[i];
  return sum / ((hi - lo + 1) * 255);
}

const Scene = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return undefined; // static gradient fallback
    }

    let gl;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      });
    } catch {
      gl = null;
    }
    if (!gl) return undefined; // static gradient fallback

    let program;
    try {
      program = compileProgram(gl);
    } catch (err) {
      console.warn('Scene shader unavailable:', err.message);
      return undefined;
    }
    gl.useProgram(program);
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uBass = gl.getUniformLocation(program, 'uBass');
    const uMid = gl.getUniformLocation(program, 'uMid');
    const uHigh = gl.getUniformLocation(program, 'uHigh');
    const uLevel = gl.getUniformLocation(program, 'uLevel');

    // Cap DPR: a soft background does not need retina resolution
    const dprCap = 1.25;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let running = true;
    let contextLost = false;
    let analyser = null;
    let freqData = null;
    // Attack/release smoothed band values
    const smooth = { bass: 0, mid: 0, high: 0, level: 0 };
    const follow = (key, target) => {
      const k = target > smooth[key] ? 0.4 : 0.06; // fast attack, slow release
      smooth[key] += (target - smooth[key]) * k;
      return smooth[key];
    };

    const onLost = (e) => {
      e.preventDefault();
      contextLost = true;
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const start = performance.now();
    const frame = () => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (contextLost || document.hidden) return;

      if (!analyser) {
        analyser = audioEngine.getAnalyser();
        if (analyser) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
      }

      let bass = 0;
      let mid = 0;
      let high = 0;
      let level = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const sr = audioEngine.context?.sampleRate || 48000;
        const fft = analyser.fftSize;
        bass = bandEnergy(freqData, sr, fft, 30, 250);
        mid = bandEnergy(freqData, sr, fft, 250, 2000);
        high = bandEnergy(freqData, sr, fft, 2000, 12000);
        level = (bass + mid + high) / 3;
      }

      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform1f(uBass, follow('bass', bass));
      gl.uniform1f(uMid, follow('mid', mid));
      gl.uniform1f(uHigh, follow('high', high));
      gl.uniform1f(uLevel, follow('level', level));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // best effort cleanup
      }
    };
  }, []);

  return (
    <div className="simple-background">
      <div className="gradient-layer"></div>
      <canvas
        ref={canvasRef}
        className="scene-shader-canvas"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
};

export default Scene;
