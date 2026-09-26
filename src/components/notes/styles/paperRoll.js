/**
 * Paper roll: the score as a player-piano roll. Aged paper runs down towards
 * the keys and every note is a slot punched through it, its length the note's
 * duration. Where a slot crosses the brass tracker bar the lamp behind the
 * roll shines through, and the bar's hole for that pitch lights up.
 *
 * Three passes a frame: the paper (a tile of its material, drawn once per size
 * and scrolled), the slots (one instanced draw) and the tracker bar (a
 * scissored strip).
 */
import {
  FULLSCREEN_VERTEX,
  GLSL_NOISE,
  bindCanvas,
  createEmptyVao,
  createInstances,
  createProgram,
  createTarget
} from '../glKit.js';
import { laneWidth, pitchX, visibleRange } from '../noteFrame.js';

// Seconds of score above the tracker bar.
const AHEAD_SECONDS = 5;
// CSS px from the canvas bottom to the bar's centre line.
const BAR_FROM_BOTTOM = 30;
const MAX_SLOTS = 1024;
const MAX_LANES = 128;
// A lit tracker hole fades this fast once its note ends.
const LANE_FADE_SECONDS = 0.14;

// CSS-pixel coordinates in fragment shaders: origin top left, y down.
const CSS_PIXEL = `
uniform vec2 uRes;
uniform float uDpr;
vec2 cssPixel() {
  return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
}
`;

// One tile of the roll's material, drawn once per size and scrolled after: its
// noise wraps every TILE_HEIGHT px of paper, so the tiles meet without a seam.
// RGB is the paper, alpha says where the paper is (its ragged edges).
const TILE_HEIGHT = 512;
const TILE_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uDpr;
const float TILE = ${TILE_HEIGHT}.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise whose lattice repeats every period cells down the roll.
float wrapNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec2 below = vec2(i.x, mod(i.y, period));
  vec2 above = vec2(i.x, mod(i.y + 1.0, period));
  float a = hash12(below);
  float b = hash12(below + vec2(1.0, 0.0));
  float c = hash12(above);
  float d = hash12(above + vec2(1.0, 0.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float wrapFbm(vec2 p, float period) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * wrapNoise(p, period);
    p = p * 2.0 + vec2(17.1, 9.0);
    period *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 size = vec2(uRes.x / uDpr, TILE);
  vec2 paper = gl_FragCoord.xy / uDpr;

  // Fibres run along the roll; foxing and grain age it.
  float fibres = wrapFbm(vec2(paper.x * 0.42, paper.y * 9.0 / TILE), 9.0);
  float mottle = wrapFbm(vec2(paper.x * 6.0 / TILE + 3.7, paper.y * 6.0 / TILE + 3.0), 6.0);
  vec2 grainCell = floor(paper * 1.5);
  float grain = hash12(vec2(grainCell.x, mod(grainCell.y, TILE * 1.5)));
  vec3 color = vec3(0.905, 0.851, 0.737);
  color *= 0.93 + 0.1 * fibres;
  color -= vec3(0.035, 0.055, 0.085) * smoothstep(0.52, 0.78, mottle);
  color += (grain - 0.5) * 0.022;

  // The printed expression line wanders down the left margin.
  float turn = paper.y * 6.2831853 / TILE;
  float wave = 34.0 + 10.0 * sin(turn * 2.0) + 5.0 * sin(turn * 5.0 + 1.3);
  float ink = 1.0 - smoothstep(0.35, 1.05, abs(paper.x - wave));
  color = mix(color, vec3(0.58, 0.16, 0.1), ink * 0.32);
  // Measure ticks down the right margin.
  float tick = step(abs(fract(paper.y / 64.0) - 0.5) * 64.0, 0.6)
    * step(size.x - 30.0, paper.x) * step(paper.x, size.x - 22.0);
  color = mix(color, vec3(0.35, 0.28, 0.2), tick * 0.35);

  // Ragged edges, a little darker where the paper has handled most.
  float edge = min(paper.x, size.x - paper.x);
  float side = paper.x < size.x * 0.5 ? 1.0 : 7.0;
  float rag = wrapNoise(vec2(side, paper.y * 102.0 / TILE), 102.0) - 0.5;
  float onPaper = smoothstep(13.0, 14.2, edge + rag * 0.8);
  color *= mix(0.86, 1.0, smoothstep(14.0, 24.0, edge));
  outColor = vec4(color, onPaper);
}
`;

const PAPER_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
${CSS_PIXEL}
uniform sampler2D uTile;
uniform float uScroll;
uniform float uBarY;
${GLSL_NOISE}

void main() {
  vec2 size = uRes / uDpr;
  vec2 px = cssPixel();
  // The paper travels down with the music: read the tile at this point of it.
  float paperY = px.y - uScroll;
  vec4 material = texture(uTile, vec2(gl_FragCoord.x / uRes.x, fract(paperY / ${TILE_HEIGHT}.0)));
  vec3 color = material.rgb;

  // The roll curls away into the spool box at the top, bends over the bar
  // (a bright crease just above it) and runs on in its shadow below.
  color *= mix(vec3(0.3, 0.25, 0.2), vec3(1.0), smoothstep(0.0, size.y * 0.42, px.y));
  color += vec3(0.07, 0.06, 0.04) * exp(-abs(px.y - (uBarY - 11.0)) * 0.45);
  float below = smoothstep(uBarY + 6.0, uBarY + 9.0, px.y);
  color *= mix(1.0, 0.42 - 0.14 * smoothstep(uBarY + 9.0, size.y, px.y), below);

  // The dark cabinet either side of the roll stays put.
  vec3 cabinet = vec3(0.07, 0.057, 0.047);
  if (material.a < 1.0) cabinet *= 0.8 + 0.4 * valueNoise(vec2(px.y * 0.05, px.x * 0.4));
  outColor = vec4(mix(cabinet, color, material.a), 1.0);
}
`;

const SLOT_VERTEX = `#version 300 es
precision highp float;
in vec4 aSlot;   // centre x (css px), start and end relative to now (s), radius (css px)
in vec2 aTouch;  // velocity, seed
uniform vec2 uSize;
uniform float uPixelsPerSecond;
uniform float uBarY;
out vec2 vPixel;
flat out vec4 vShape;  // upper cap centre y, lower cap centre y, radius, centre x
flat out vec3 vLight;  // velocity, seed, how lit (0..1)
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  float radius = aSlot.w;
  // The paper runs down: a slot's lower end meets the bar when its note starts.
  float lower = uBarY - aSlot.y * uPixelsPerSecond;
  float upper = uBarY - aSlot.z * uPixelsPerSecond;
  float a = upper + radius;
  float b = lower - radius;
  if (a > b) {
    a = (a + b) * 0.5;
    b = a;
  }
  float pad = 4.0;
  vec2 pixel = vec2(
    aSlot.x + (corner.x * 2.0 - 1.0) * (radius + pad),
    mix(a - radius - pad, b + radius + pad, corner.y)
  );
  vPixel = pixel;
  vShape = vec4(a, b, radius, aSlot.x);
  // Lit from its start until just after its end.
  float lit = step(aSlot.y, 0.0) * smoothstep(-0.12, 0.0, aSlot.z);
  vLight = vec3(aTouch, lit);
  gl_Position = vec4(pixel.x / uSize.x * 2.0 - 1.0, 1.0 - pixel.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

const SLOT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vPixel;
flat in vec4 vShape;
flat in vec3 vLight;
out vec4 outColor;
uniform float uBarY;
uniform float uDpr;

// A punched slot: a capsule whose long sides scallop gently, like the
// chained perforations of a real roll.
float slotDistance(vec2 p) {
  float a = vShape.x;
  float b = vShape.y;
  float r = vShape.z;
  vec2 q = vec2(p.x - vShape.w, p.y);
  float along = clamp(q.y, a, b);
  float chain = 1.0 - 0.07 * (1.0 - abs(cos((q.y - a) * 3.14159 / (1.6 * r))));
  float radius = r * mix(1.0, chain, step(r * 1.5, b - a));
  return length(vec2(q.x, q.y - along)) - radius;
}

void main() {
  float d = slotDistance(vPixel);
  float aa = 0.9 / uDpr;
  float hole = 1.0 - smoothstep(-aa, aa, d);
  // The cut edge above casts a crescent of shadow into the hole.
  float shaded = smoothstep(-aa, aa, slotDistance(vPixel - vec2(0.0, 2.6)));
  // The paper dips a little around each hole.
  float dent = (1.0 - smoothstep(0.0, 2.4, d)) * (1.0 - hole);

  // Inside: the dark cabinet, or lamplight through the bar while it sounds.
  vec3 dark = vec3(0.085, 0.066, 0.052);
  // The lamp sits behind the bar: it lights the slot above it, not the paper past it.
  float above = uBarY - vPixel.y;
  float nearBar = above >= 0.0 ? exp(-above / 60.0) : exp(above / 5.0);
  float lamp = vLight.z * (0.55 + 0.45 * vLight.x) * nearBar;
  vec3 light = mix(vec3(0.92, 0.42, 0.1), vec3(1.0, 0.86, 0.58), clamp(lamp, 0.0, 1.0));
  vec3 inside = mix(dark, light, clamp(lamp * 1.15, 0.0, 1.0));
  // Holes that have gone past the bar sink into its shadow.
  inside *= mix(1.0, 0.55, step(uBarY + 8.0, vPixel.y));
  inside *= 1.0 - 0.55 * shaded * (1.0 - clamp(lamp, 0.0, 1.0) * 0.6);

  vec3 color = mix(vec3(0.33, 0.26, 0.19), inside, hole);
  float alpha = max(hole, dent * 0.28);
  outColor = vec4(color, alpha);
}
`;

const BAR_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
${CSS_PIXEL}
uniform float uBarY;
uniform float uLaneCount;
uniform vec4 uLanes[32];
${GLSL_NOISE}

float laneLight(float lane) {
  if (lane < 0.0 || lane >= uLaneCount) return 0.0;
  int i = int(lane);
  return uLanes[i >> 2][i & 3];
}

void main() {
  vec2 size = uRes / uDpr;
  vec2 px = cssPixel();
  float lanePx = size.x / uLaneCount;
  float laneF = px.x / lanePx;
  float lane = floor(laneF);

  // Lamplight spilling out of the lit holes, onto the bar and the paper. Its
  // reach shrinks with the lanes, and three lanes either side let it fade out
  // before the search ends, even on a phone.
  float reach = min(8.0, lanePx * 0.8);
  float spill = 0.0;
  for (int k = -3; k <= 3; k++) {
    float l = lane + float(k);
    float lit = laneLight(l);
    if (lit <= 0.0) continue;
    vec2 q = px - vec2((l + 0.5) * lanePx, uBarY);
    spill += lit * exp(-length(q * vec2(1.0, 1.7)) / reach);
  }

  float top = uBarY - 8.0;
  float bottom = uBarY + 8.0;
  float coverage = smoothstep(top, top + 0.9, px.y) * (1.0 - smoothstep(bottom - 0.9, bottom, px.y));
  float v = clamp((px.y - top) / (bottom - top), 0.0, 1.0);
  // Brass: a bright shoulder, a darker underside, brushed along its length.
  vec3 brass = mix(vec3(0.36, 0.24, 0.08), vec3(0.86, 0.65, 0.3), smoothstep(0.0, 0.28, v));
  brass = mix(brass, vec3(0.28, 0.19, 0.07), smoothstep(0.45, 1.0, v));
  brass *= 0.9 + 0.12 * valueNoise(vec2(px.x * 0.9, px.y * 12.0));
  brass += vec3(0.32, 0.26, 0.15) * exp(-abs(v - 0.2) * 28.0);
  // One hole per pitch, lit while its note sounds.
  vec2 q = vec2((fract(laneF) - 0.5) * lanePx, px.y - uBarY);
  float radius = clamp(lanePx * 0.16, 1.2, 3.0);
  float hole = 1.0 - smoothstep(-0.6, 0.6, length(q) - radius);
  vec3 holeColor = mix(vec3(0.05, 0.035, 0.02), vec3(1.0, 0.8, 0.5), laneLight(lane));
  vec3 bar = mix(brass, holeColor, hole);

  vec3 light = vec3(1.0, 0.6, 0.24) * spill * 0.85;
  // Premultiplied: the bar covers what is under it, the spill adds light.
  outColor = vec4(bar * coverage + light, coverage);
}
`;

function createPaperRoll(gl) {
  const emptyVao = createEmptyVao(gl);
  const tileProgram = createProgram(gl, FULLSCREEN_VERTEX, TILE_FRAGMENT, ['uRes', 'uDpr']);
  const paper = createProgram(gl, FULLSCREEN_VERTEX, PAPER_FRAGMENT, [
    'uRes', 'uDpr', 'uTile', 'uScroll', 'uBarY'
  ]);
  const tile = createTarget(gl);
  const slots = createProgram(gl, SLOT_VERTEX, SLOT_FRAGMENT, [
    'uSize', 'uPixelsPerSecond', 'uBarY', 'uDpr'
  ]);
  const bar = createProgram(gl, FULLSCREEN_VERTEX, BAR_FRAGMENT, [
    'uRes', 'uDpr', 'uBarY', 'uLaneCount', 'uLanes'
  ]);
  const instances = createInstances(gl, slots.program, [['aSlot', 4], ['aTouch', 2]], MAX_SLOTS);
  const range = { start: 0, end: 0 };
  const laneTarget = new Float32Array(MAX_LANES);
  const laneLevel = new Float32Array(MAX_LANES);

  const render = (frame) => {
    const { width, height, songTime, notes } = frame;
    const barY = height - BAR_FROM_BOTTOM;
    const pixelsPerSecond = Math.max(10, (barY - 8) / AHEAD_SECONDS);
    const laneCount = Math.min(MAX_LANES, frame.high - frame.low + 1);
    const lanePx = laneWidth(frame) * width;
    const radiusBase = Math.min(10, Math.max(2, lanePx * 0.27));

    // Slots from just below the canvas to just above it.
    visibleRange(frame, (height - barY) / pixelsPerSecond + 0.3, AHEAD_SECONDS + 0.5, range);
    laneTarget.fill(0);
    const data = instances.data;
    let count = 0;
    for (let index = range.start; index < range.end && count < MAX_SLOTS; index += 1) {
      const note = notes[index];
      const startIn = note.time - songTime;
      const endIn = note.end - songTime;
      if (endIn * pixelsPerSecond < barY - height - 20) continue;
      const offset = count * instances.stride;
      data[offset] = pitchX(frame, note.midi) * width;
      data[offset + 1] = startIn;
      data[offset + 2] = endIn;
      data[offset + 3] = radiusBase * (0.86 + 0.24 * note.velocity);
      data[offset + 4] = note.velocity;
      data[offset + 5] = note.seed;
      count += 1;
      if (startIn <= 0 && endIn > 0) {
        const lane = note.midi - frame.low;
        if (lane >= 0 && lane < laneCount) {
          laneTarget[lane] = Math.max(laneTarget[lane], 0.6 + 0.4 * note.velocity);
        }
      }
    }
    const fade = Math.exp(-frame.dt / LANE_FADE_SECONDS);
    for (let lane = 0; lane < MAX_LANES; lane += 1) {
      laneLevel[lane] = frame.jumped
        ? laneTarget[lane]
        : Math.max(laneTarget[lane], laneLevel[lane] * fade);
    }
    instances.upload(count);

    bindCanvas(gl, frame);
    gl.disable(gl.BLEND);
    gl.useProgram(paper.program);
    gl.uniform2f(paper.uniforms.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(paper.uniforms.uDpr, frame.dpr);
    gl.uniform1f(paper.uniforms.uScroll, songTime * pixelsPerSecond);
    gl.uniform1f(paper.uniforms.uBarY, barY);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    gl.uniform1i(paper.uniforms.uTile, 0);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(slots.program);
    gl.uniform2f(slots.uniforms.uSize, width, height);
    gl.uniform1f(slots.uniforms.uPixelsPerSecond, pixelsPerSecond);
    gl.uniform1f(slots.uniforms.uBarY, barY);
    gl.uniform1f(slots.uniforms.uDpr, frame.dpr);
    instances.draw(count);

    // The bar and the light around it: a strip, not the whole canvas.
    gl.enable(gl.SCISSOR_TEST);
    const stripTop = Math.max(0, barY - 34);
    const stripBottom = Math.min(height, barY + 18);
    gl.scissor(
      0,
      Math.floor(frame.pixelHeight - stripBottom * frame.dpr),
      frame.pixelWidth,
      Math.ceil((stripBottom - stripTop) * frame.dpr)
    );
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(bar.program);
    gl.uniform2f(bar.uniforms.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(bar.uniforms.uDpr, frame.dpr);
    gl.uniform1f(bar.uniforms.uBarY, barY);
    gl.uniform1f(bar.uniforms.uLaneCount, laneCount);
    gl.uniform4fv(bar.uniforms.uLanes, laneLevel);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  // The paper's material, one tile the width of the canvas.
  const resize = (frame) => {
    if (!tile.resize(frame.pixelWidth, TILE_HEIGHT * frame.dpr)) return;
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    tile.bind();
    gl.disable(gl.BLEND);
    gl.useProgram(tileProgram.program);
    gl.uniform2f(tileProgram.uniforms.uRes, tile.width, tile.height);
    gl.uniform1f(tileProgram.uniforms.uDpr, frame.dpr);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  return {
    resize,
    render,
    dispose() {
      instances.dispose();
      tile.dispose();
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(tileProgram.program);
      gl.deleteProgram(paper.program);
      gl.deleteProgram(slots.program);
      gl.deleteProgram(bar.program);
    }
  };
}

export default {
  id: 'paper',
  create: createPaperRoll
};
