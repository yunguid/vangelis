import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { getCappedDevicePixelRatio } from '../utils/canvasPerformance.js';
import { startVisibilityAwareRafLoop } from '../utils/visibilityRaf.js';
import { VortexField } from '../utils/vizPhysics.js';
import { resolveSceneFrameInterval } from '../utils/visualFramePolicy.js';
import {
  SCENE_FREQUENCY_BANDS,
  createSceneBandBinRanges,
  sampleSceneBandEnergies
} from '../utils/sceneBandAnalysis.js';

// Audio-reactive WebGL2 background.
// Falls back to the static gradient (the underlay div) when WebGL2 is
// unavailable, the user prefers reduced motion, or the GL context is lost.
//
// The smoke is driven by a Lagrangian vortex-particle system (vizPhysics.js):
// bass onsets inject circulation, particles Verlet-advect through each
// other's regularized Biot–Savart fields on the CPU, and the fragment shader
// backtraces its noise domain through the analytic velocity field
// (semi-Lagrangian advection) plus a truncated Fourier series whose
// coefficients are the live audio spectrum bands.

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
uniform float uPulse;  // 0..1 transient (bass onset), fast decay
uniform float uMorph;  // ever-advancing phase; music makes it run faster
uniform vec2 uVortexPos[10];   // Lagrangian vortex particles (CPU-simulated)
uniform float uVortexStr[10];  // signed circulation per vortex
uniform float uVortexRad[10];  // core radius per vortex
uniform float uBands[8];       // live log-spaced spectrum bands (Fourier)

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

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Velocity induced at p by the vortex particles: the curl of regularized
// Lamb-Oseen-style cores (matches VortexField.velocityAt on the CPU).
vec2 vortexVelocity(vec2 p) {
  vec2 vel = vec2(0.0);
  for (int i = 0; i < 10; i++) {
    if (uVortexStr[i] == 0.0) continue;
    vec2 r = p - uVortexPos[i];
    float d2 = dot(r, r);
    float rad2 = uVortexRad[i] * uVortexRad[i];
    float fall = 1.0 - exp(-d2 / rad2);
    vel += uVortexStr[i] * fall / (d2 + rad2 * 0.25) * vec2(-r.y, r.x);
  }
  return vel;
}

// Truncated Fourier series over the live spectrum: each audio band k powers
// the k-th spatial harmonic, so the smoke literally ripples at the music's
// spectral shape (1/k weighting keeps it a convergent, smooth series).
float spectralRipple(vec2 p, float t) {
  float s = 0.0;
  for (int k = 0; k < 8; k++) {
    float fk = float(k + 1);
    s += uBands[k] / fk * sin(p.y * fk * 2.1 + p.x * fk * 0.9 + t * (0.5 + fk * 0.17));
  }
  return s;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

  float t = uTime * 0.028;

  // Slow scene-state oscillators on incommensurate periods: the composition
  // (rotation, zoom, palette, drift direction) keeps evolving and never loops.
  float m1 = sin(uMorph * 0.31 + sin(uMorph * 0.113) * 1.7);
  float m2 = cos(uMorph * 0.171 + 2.3);

  p = rot(uMorph * 0.04) * p;
  float zoom = 1.12 + 0.18 * m2 + uLevel * 0.06;
  vec2 q = p * zoom;

  // Semi-Lagrangian advection: backtrace the noise domain through the
  // vortex particles' velocity field so the smoke visibly swirls around
  // the circulation the music injects, instead of just wobbling in place.
  vec2 flow = vortexVelocity(p);
  q -= flow * 0.45;

  // Fourier-series ripple shaped by the live spectrum bands.
  float ripple = spectralRipple(q, uTime);
  q += vec2(ripple * 0.05, ripple * 0.1);

  // Domain-warped aurora bands; bass leans on the warp gently,
  // mids nudge the drift, the morph phase bends its direction over time.
  vec2 warp = vec2(
    fbm(q * 1.4 + vec2(t * (1.0 + 0.4 * m1), -t * 0.7)),
    fbm(q * 1.4 + vec2(-t * 0.8, t * 0.6) + 5.0 + uMorph * 0.02)
  );
  float w = 0.7 + uBass * 0.6 + uPulse * 0.2;
  float field = fbm(q * 1.1 + warp * w + vec2(0.0, t * (0.6 + uMid * 0.4)));

  // Counter-current layer drifting the other way for depth
  float field2 = fbm(q * 2.3 - warp * 0.7 - vec2(t * 0.9, t * 0.35));

  // Transients send one broad, slow swell out from the center
  float r = length(p);
  field += uPulse * 0.1 * sin(r * 5.0 - uTime * 1.8) * exp(-r * 1.1);

  // Palette morphs between ember/moss and magenta-ember/steel-blue
  vec3 base = vec3(0.075, 0.082, 0.09);
  float mixAmt = 0.5 + 0.5 * m1;
  vec3 ember = mix(vec3(0.55, 0.28, 0.06), vec3(0.52, 0.14, 0.18), mixAmt);
  vec3 aqua = mix(vec3(0.18, 0.34, 0.24), vec3(0.1, 0.26, 0.4), 1.0 - mixAmt * 0.8);

  float glow = smoothstep(0.35, 0.95, field);
  vec3 col = base;
  col += ember * glow * (0.24 + uBass * 0.42 + uPulse * 0.1);
  col += aqua * smoothstep(0.55, 1.0, field) * (0.18 + uHigh * 0.55);
  col += ember * 0.35 * smoothstep(0.6, 1.0, field2) * (0.15 + uMid * 0.35);

  // Swirling regions catch a faint extra glow (kinetic energy -> light)
  col += ember * min(dot(flow, flow) * 0.4, 0.22) * glow;

  // High frequencies breathe soft glints into the grain (no hard pops)
  float grain = noise(q * 22.0 + vec2(t * 2.0, -t * 1.4));
  float glint = smoothstep(0.9, 1.0, grain) * uHigh;
  col += vec3(0.85, 0.7, 0.5) * glint * 0.18;

  // Loudness lifts the whole scene gently
  col *= 0.9 + uLevel * 0.24;

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
    window.__sceneShaderOk = true; // verification probe
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uBass = gl.getUniformLocation(program, 'uBass');
    const uMid = gl.getUniformLocation(program, 'uMid');
    const uHigh = gl.getUniformLocation(program, 'uHigh');
    const uLevel = gl.getUniformLocation(program, 'uLevel');
    const uPulse = gl.getUniformLocation(program, 'uPulse');
    const uMorph = gl.getUniformLocation(program, 'uMorph');
    const uVortexPos = gl.getUniformLocation(program, 'uVortexPos');
    const uVortexStr = gl.getUniformLocation(program, 'uVortexStr');
    const uVortexRad = gl.getUniformLocation(program, 'uVortexRad');
    const uBands = gl.getUniformLocation(program, 'uBands');

    // Cap DPR: a soft background does not need retina resolution
    const resize = () => {
      const dpr = getCappedDevicePixelRatio(1.25);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resize)
      : null;
    if (resizeObserver) resizeObserver.observe(canvas);
    else window.addEventListener('resize', resize);

    let running = true;
    let contextLost = false;
    let analyser = null;
    let freqData = null;
    let sceneBinRanges = null;
    let sceneBinSampleRate = 0;
    let sceneBinFftSize = 0;
    let sceneBinCount = 0;
    const sceneBandEnergies = new Float64Array(SCENE_FREQUENCY_BANDS.length);
    // Attack/release smoothed band values — deliberately slow both ways so
    // the scene swells and subsides instead of twitching with the music.
    const smooth = { bass: 0, mid: 0, high: 0, level: 0 };
    const follow = (key, target) => {
      const k = target > smooth[key] ? 0.09 : 0.03;
      smooth[key] += (target - smooth[key]) * k;
      return smooth[key];
    };
    // Transient detector (bass onsets ring the shader's shockwave) and a
    // morph phase that always creeps forward but runs faster with the music,
    // so the scene composition keeps evolving instead of looping.
    // Onsets = fast envelope rising above a slow baseline; frame-to-frame
    // deltas are useless here because the analyser already smooths heavily.
    let bassSlow = 0;
    let pulse = 0;
    let morphPhase = Math.random() * 100;
    let lastFrameTime = performance.now();
    let lastRenderedAt = 0;
    let hasSignal = false;

    // Lagrangian vortex particles: bass onsets inject circulation, highs
    // sprinkle fine turbulence; the strongest ten reach the shader. Long
    // decay + ramp-in keeps swirls emerging and dissolving, never popping.
    const vortices = new VortexField({ maxParticles: 12, decay: 0.12, rampTime: 0.9 });
    const VORTEX_SLOTS = 10;
    const vortexPos = new Float32Array(VORTEX_SLOTS * 2);
    const vortexStr = new Float32Array(VORTEX_SLOTS);
    const vortexRad = new Float32Array(VORTEX_SLOTS);
    let lastInjectAt = 0;

    const bands = new Float32Array(8);
    const sceneDebug = { vortexCount: 0, pulse: 0, level: 0 };
    window.__sceneDebug = sceneDebug;

    let stopFrameLoop = () => undefined;
    const onLost = (e) => {
      e.preventDefault();
      contextLost = true;
      stopFrameLoop();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const start = performance.now();
    const frame = (frameTime) => {
      if (!running) return;
      if (contextLost) return;
      if (frameTime - lastRenderedAt < resolveSceneFrameInterval(hasSignal)) return;
      lastRenderedAt = frameTime;

      if (!analyser) {
        analyser = audioEngine.getAnalyser();
      }

      let bass = 0;
      let mid = 0;
      let high = 0;
      let level = 0;
      if (analyser) {
        if (!freqData || freqData.length !== analyser.frequencyBinCount) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqData);
        const sampleRate = audioEngine.context?.sampleRate || 48000;
        const fftSize = analyser.fftSize;
        if (
          !sceneBinRanges
          || sceneBinSampleRate !== sampleRate
          || sceneBinFftSize !== fftSize
          || sceneBinCount !== freqData.length
        ) {
          sceneBinRanges = createSceneBandBinRanges({
            sampleRate,
            fftSize,
            binCount: freqData.length
          });
          sceneBinSampleRate = sampleRate;
          sceneBinFftSize = fftSize;
          sceneBinCount = freqData.length;
        }
        sampleSceneBandEnergies(freqData, sceneBinRanges, sceneBandEnergies);
        bass = sceneBandEnergies[0];
        mid = sceneBandEnergies[1];
        high = sceneBandEnergies[2];
        level = (bass + mid + high) / 3;
        for (let b = 0; b < 8; b++) {
          const e = sceneBandEnergies[b + 3];
          // Slow attack/release so the ripple breathes instead of flickering
          bands[b] += (e - bands[b]) * (e > bands[b] ? 0.12 : 0.04);
        }
      }

      const now = frameTime;
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;

      // Slow baseline tracks sustained bass; the excess above it is the hit.
      bassSlow += (bass - bassSlow) * (bass > bassSlow ? 0.06 : 0.02);
      const onset = Math.max(0, bass - bassSlow) * 3.5;
      pulse = Math.min(1, Math.max(pulse * Math.exp(-dt * 1.6), onset));
      morphPhase += dt * (0.05 + level * 0.3);

      // Inject circulation on bass onsets (rate-limited); sprinkle small
      // counter-rotating turbulence when the top end is busy; keep a mild
      // ambient swirl going whenever there is any signal at all. Broad,
      // soft cores + slow decay = flowing currents rather than jolts.
      if (onset > 0.1 && now - lastInjectAt > 450) {
        lastInjectAt = now;
        const sign = Math.random() < 0.5 ? -1 : 1;
        vortices.inject({
          x: (Math.random() - 0.5) * 1.8,
          y: (Math.random() - 0.7) * 1.2,
          strength: sign * (0.1 + Math.min(onset, 1) * 0.2),
          radius: 0.55 + Math.random() * 0.4
        });
      }
      // Poisson-style rates (per second, scaled by dt so frame rate is moot)
      if (high > 0.12 && Math.random() < dt * (0.1 + high * 0.7)) {
        vortices.inject({
          x: (Math.random() - 0.5) * 2.2,
          y: (Math.random() - 0.5) * 1.6,
          strength: (Math.random() < 0.5 ? -1 : 1) * (0.04 + high * 0.06),
          radius: 0.3 + Math.random() * 0.2
        });
      }
      if (level > 0.04 && vortices.particles.length < 3 && Math.random() < dt * 0.5) {
        vortices.inject({
          x: (Math.random() - 0.5) * 1.6,
          y: (Math.random() - 0.5) * 1.2,
          strength: (Math.random() < 0.5 ? -1 : 1) * (0.08 + level * 0.18),
          radius: 0.6 + Math.random() * 0.35
        });
      }
      hasSignal = level > 0.015 || pulse > 0.01 || vortices.particles.length > 0;
      vortices.step(dt);
      vortices.fillUniforms(vortexPos, vortexStr, vortexRad);
      sceneDebug.vortexCount = vortices.particles.length;
      sceneDebug['pulse'] = pulse;
      sceneDebug.level = level;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uBass, follow('bass', bass));
      gl.uniform1f(uMid, follow('mid', mid));
      gl.uniform1f(uHigh, follow('high', high));
      gl.uniform1f(uLevel, follow('level', level));
      gl.uniform1f(uPulse, pulse);
      gl.uniform1f(uMorph, morphPhase);
      gl.uniform2fv(uVortexPos, vortexPos);
      gl.uniform1fv(uVortexStr, vortexStr);
      gl.uniform1fv(uVortexRad, vortexRad);
      gl.uniform1fv(uBands, bands);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    stopFrameLoop = startVisibilityAwareRafLoop(frame);

    return () => {
      running = false;
      stopFrameLoop();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      // Do NOT force-lose the context here: the canvas element survives a
      // StrictMode remount, and a force-lost context stays dead on the next
      // mount (shader compiles fail with a null info log, killing the scene).
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

export default React.memo(Scene);
