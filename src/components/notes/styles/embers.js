/**
 * Embers: a forge at night, where notes are fire. Each coming note falls as a
 * faint streak of ash towards the hearth along the bottom edge, the keys just
 * below it, and touches it as the note starts. There it catches: sparks burst
 * up, and a small flickering coal burns in its place while the note is held,
 * shedding embers, then dims once it ends. Embers rise on the heat, drift on a
 * curl-noise draught and cool from white-yellow through orange and deep red
 * to dark.
 *
 * Five passes a frame: smoke and floor light into a quarter-size target (from
 * a noise tile baked once), that light upscaled over the dark, the ash (one
 * instanced draw), the coals (one per lit pitch) and the embers. Embers live
 * in a ring of instanced quads: each is written once, at its birth, and the
 * vertex shader works out where it is from its age.
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
import { laneWidth, onsetRange, pitchX, visibleRange } from '../noteFrame.js';

// Seconds of score above the hearth.
const AHEAD_SECONDS = 4;
// CSS px from the canvas bottom up to the hearth, where notes catch.
const HEARTH_FROM_BOTTOM = 5;
// A coal dims over this long once its note ends.
const RELEASE_SECONDS = 0.5;
// The flash as a note catches fades this fast.
const FLARE_SECONDS = 0.12;
// A held coal sheds a flurry as it catches that settles over this long.
const SHED_SETTLE_SECONDS = 1.2;
// Notes starting this close together are one chord.
const CHORD_SECONDS = 0.035;
// With no score the banked hearth lets an ember go now and then.
const IDLE_EMBERS_PER_SECOND = 1.2;
const MAX_STREAKS = 1024;
const MAX_LANES = 128;
const MAX_EMBERS = 8192;
// No ember lives longer than this (s).
const MAX_LIFE = 4;
// Enough for a dense chord; more would only overwrite embers still in flight.
const MAX_SPAWN_PER_FRAME = 384;
// The shader clock starts again from zero well before float32 loses precision.
const CLOCK_REBASE_SECONDS = 1024;
const NOISE_SIZE = 256;
// Smoke and floor light are soft: a quarter of the canvas resolution is plenty.
const LIGHT_SCALE = 0.25;

// Heat 0..1 to the colour of cooling fire: white-yellow, orange, deep red, dark.
const FIRE_RAMP = `
vec3 fireColor(float heat) {
  float t = clamp(heat, 0.0, 1.0);
  vec3 color = vec3(0.34, 0.045, 0.01) * smoothstep(0.0, 0.25, t);
  color = mix(color, vec3(0.84, 0.25, 0.04), smoothstep(0.2, 0.48, t));
  color = mix(color, vec3(1.0, 0.52, 0.11), smoothstep(0.45, 0.7, t));
  color = mix(color, vec3(1.0, 0.76, 0.3), smoothstep(0.68, 0.88, t));
  return mix(color, vec3(1.0, 0.95, 0.82), smoothstep(0.86, 1.0, t));
}
`;

// CSS-pixel quads: origin top left, y down.
const CLIP_FROM_CSS = `
vec4 clipFromCss(vec2 pixel, vec2 size) {
  return vec4(pixel.x / size.x * 2.0 - 1.0, 1.0 - pixel.y / size.y * 2.0, 0.0, 1.0);
}
`;

// Four channels of value-noise fbm whose lattice wraps, so the tile repeats
// without a seam: two smoke layers and a warp field.
const NOISE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${GLSL_NOISE}

float wrapNoise(vec2 p, float period, float salt) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, period) + salt);
  float b = hash12(mod(i + vec2(1.0, 0.0), period) + salt);
  float c = hash12(mod(i + vec2(0.0, 1.0), period) + salt);
  float d = hash12(mod(i + vec2(1.0, 1.0), period) + salt);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float wrapFbm(vec2 uv, float period, float salt) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * wrapNoise(uv * period, period, salt);
    period *= 2.0;
    amp *= 0.5;
  }
  return sum / 0.9375;
}

void main() {
  outColor = vec4(
    wrapFbm(vUv, 4.0, 0.0),
    wrapFbm(vUv, 8.0, 17.0),
    wrapFbm(vUv, 3.0, 41.0),
    wrapFbm(vUv, 3.0, 73.0)
  );
}
`;

// Smoke and the hearth's light, at a quarter of the resolution.
const LIGHT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uSize;
uniform float uHearth;
uniform float uTime;
uniform float uFloor;
uniform float uLaneCount;
uniform vec4 uLanes[32];
uniform sampler2D uNoise;

float laneLight(float lane) {
  if (lane < 0.0 || lane >= uLaneCount) return 0.0;
  int i = int(lane);
  return uLanes[i >> 2][i & 3];
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float up = max(uHearth - px.y, 0.0);
  float lane = px.x / uSize.x * uLaneCount - 0.5;
  float i = floor(lane);
  float local = mix(laneLight(i), laneLight(i + 1.0), lane - i);

  // A banked light along the floor that swells with the music and pools
  // under the coals.
  float room = exp(-up / (uSize.y * 0.18)) * (0.12 + 0.22 * uFloor);
  float pool = local * (0.5 * exp(-up / 14.0) + 0.2 * exp(-up / (uSize.y * 0.3)));
  float fire = room + pool;
  vec3 color = vec3(0.5, 0.17, 0.04) * fire;

  // Smoke: the baked noise, warped and rising, lit from below.
  vec2 uv = px / 520.0;
  vec2 warp = texture(uNoise, uv * 0.45 + vec2(0.006, 0.011) * uTime).ba - 0.5;
  vec2 q = uv + vec2(0.0, 0.03 * uTime) + warp * 0.4;
  float density = texture(uNoise, q).r * 0.6
    + texture(uNoise, q * 2.2 + vec2(0.3, 0.035 * uTime)).g * 0.4;
  float wisps = smoothstep(0.5, 0.82, density) * (1.0 - smoothstep(0.0, uSize.y * 0.95, up));
  vec3 smoke = mix(vec3(0.055, 0.046, 0.04), vec3(0.2, 0.085, 0.03), min(1.0, fire * 2.0));
  color += smoke * wisps * (0.3 + 2.2 * fire);
  // Alpha: how much fire sounds right here, for the coal bed.
  outColor = vec4(color, local);
}
`;

const BACKDROP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uLight;
uniform vec2 uRes;
uniform float uDpr;
uniform float uHearth;
uniform float uTime;
${GLSL_NOISE}
${FIRE_RAMP}

void main() {
  // Near-black and warm; the top of the room falls away a little further.
  vec4 light = texture(uLight, vUv);
  vec3 color = vec3(0.051, 0.035, 0.027) * mix(1.0, 0.72, smoothstep(0.35, 1.0, vUv.y)) + light.rgb;
  // A bed of banked coals under the hearth: dark, its cracks lit where fire
  // sounds above them.
  float below = (uRes.y - gl_FragCoord.y) / uDpr - uHearth + 2.0;
  if (below > 0.0) {
    vec2 q = vec2(gl_FragCoord.x / uDpr * 0.11, below * 0.35 + uTime * 0.03);
    float n = valueNoise(q) * 0.6 + valueNoise(q * 2.7 + 5.3) * 0.4;
    float crack = 1.0 - smoothstep(0.0, 0.1, abs(n - 0.5));
    float fire = min(1.0, light.a);
    color += fireColor(0.25 + 0.4 * fire) * crack * smoothstep(0.0, 3.0, below)
      * (0.2 + 0.75 * fire);
  }
  // Dither: these dark ramps band in 8 bits.
  color += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(color, 1.0);
}
`;

const ASH_VERTEX = `#version 300 es
precision highp float;
in vec4 aStreak;  // centre x (css px), start and end relative to now (s), half width (css px)
in vec2 aTrait;   // loudness 0..1, seed
uniform vec2 uSize;
uniform float uPixelsPerSecond;
uniform float uHearth;
out vec2 vPixel;
flat out vec4 vShape;  // head y, tail y, half width, centre x
flat out vec4 vTrait;  // loudness, seed, nearness 0..1, held 0/1
${CLIP_FROM_CSS}
const vec2 CORNERS[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0)
);
void main() {
  vec2 corner = CORNERS[gl_VertexID % 6];
  // The head reaches the hearth as the note starts; while it is held the head
  // stays there and the streak burns down into it.
  float head = uHearth - max(aStreak.y, 0.0) * uPixelsPerSecond;
  float tail = uHearth - aStreak.z * uPixelsPerSecond;
  float r = aStreak.w;
  float pad = r * 5.0 + 3.0;
  // Two quads: a narrow one down the thread and a wide one round the cinder,
  // so a long thread costs little more than its own few pixels.
  bool wide = gl_VertexID >= 6;
  float halfWidth = wide ? pad : r + 1.5;
  float top = wide ? head - pad : tail - 1.5;
  float bottom = wide ? head + pad : max(tail - 1.5, head - pad);
  vec2 pixel = vec2(
    aStreak.x + (corner.x * 2.0 - 1.0) * halfWidth,
    mix(top, bottom, corner.y)
  );
  vPixel = pixel;
  vShape = vec4(head, tail, r, aStreak.x);
  vTrait = vec4(aTrait, 1.0 - clamp(aStreak.y / 1.5, 0.0, 1.0), step(aStreak.y, 0.0));
  gl_Position = clipFromCss(pixel, uSize);
}
`;

const ASH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vPixel;
flat in vec4 vShape;
flat in vec4 vTrait;
out vec4 outColor;
uniform float uDpr;
uniform float uHearth;
uniform float uTrail;
uniform float uFuse;
${FIRE_RAMP}

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

void main() {
  float head = vShape.x;
  float tail = vShape.y;
  float r = vShape.z;
  float near = vTrait.z;
  float held = vTrait.w;
  vec2 p = vec2(vPixel.x - vShape.w, vPixel.y);
  float aa = 0.75 / uDpr;
  float along = clamp(p.y, tail, head);
  float d = length(vec2(p.x, p.y - along));
  float line = 1.0 - smoothstep(r - aa, r + aa, d);
  float fromHead = head - p.y;
  // Specks of ash that travel with the streak.
  float s = fromHead * 0.3 + vTrait.y * 97.0;
  float cell = floor(s);
  float speck = mix(hash11(cell), hash11(cell + 1.0), smoothstep(0.0, 1.0, fract(s)));
  // Bright just behind the falling cinder, then a faint thread as long as the
  // note (above a burning coal, only its last stretch); out of the dark at
  // the top, thinning away at its tail.
  float span = head - tail;
  float thread = 0.14 * mix(1.0, exp(-(uHearth - p.y) / uFuse), held);
  float trail = thread + 0.86 * exp(-fromHead / uTrail) * (1.0 - held);
  float ash = line * trail * (0.45 + 0.55 * speck)
    * smoothstep(tail, tail + min(24.0, span * 0.6), p.y)
    * smoothstep(0.0, 36.0, p.y);

  // The cinder at its head warms as it nears the hearth; over a coal the
  // thread is scorched instead.
  float cr = r * 2.2 + 0.5;
  float dh = length(vec2(p.x, p.y - head));
  float shown = (1.0 - held) * smoothstep(0.0, 30.0, head);
  float cinder = (1.0 - smoothstep(cr - aa, cr + aa, dh)) * shown;
  float halo = exp(-dh / (cr * 1.6)) * shown * (0.2 + 0.6 * near * near)
    * (1.0 - smoothstep(0.5, 1.0, dh / (r * 5.0 + 3.0)));
  float scorch = held * line * exp(-(uHearth - p.y) / 14.0);
  // Ash-brown round a dull ember far off; it takes fire as it comes down.
  vec3 ashColor = vec3(0.5, 0.39, 0.3);
  vec3 cinderColor = mix(ashColor * 0.45, fireColor(0.3 + 0.42 * near), 0.45 + 0.55 * near);
  vec3 trailColor = mix(ashColor, fireColor(0.45), 0.6 * near * (1.0 - held));
  vec3 color = trailColor * ash * 0.5
    + fireColor(0.55) * scorch * 0.7
    + cinderColor * (cinder * (0.65 + 0.35 * near) + halo * 0.45);
  outColor = vec4(color, max(ash * 0.5, cinder * 0.9));
}
`;

const COAL_VERTEX = `#version 300 es
precision highp float;
in vec4 aCoal;  // centre x (css px), level 0..1, flare 0..1, seed
in vec2 aSize;  // half width, flame height (css px)
uniform vec2 uSize;
uniform float uHearth;
uniform float uTime;
uniform float uFlicker;
out vec2 vPixel;
flat out vec4 vCoal;   // centre x, level, flare, lean of the tip (css px)
flat out vec4 vFlame;  // half width, height, phase of the licks, reach of the quad
${CLIP_FROM_CSS}
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  float w = aSize.x;
  float seed = aCoal.w;
  float t = uTime * (0.9 + 0.3 * seed) * uFlicker + seed * 37.0;
  // Incommensurate sines, so no two coals or two moments agree.
  float flick = 0.5 * sin(t * 7.1) + 0.3 * sin(t * 12.3 + 1.7) + 0.2 * sin(t * 19.7 + 4.1);
  float height = max(aSize.y * (0.85 + 0.3 * seed) * (1.0 + 0.18 * flick * uFlicker), w * 2.6);
  float lean = (0.6 * sin(t * 3.7 + 2.0) + 0.4 * sin(t * 8.9)) * w * 0.6 * uFlicker;
  float reach = w * 3.0 + 3.0;
  vec2 pixel = vec2(
    aCoal.x + (corner.x * 2.0 - 1.0) * (reach + abs(lean)),
    mix(uHearth - height - reach, max(uHearth + reach * 0.6, uSize.y), corner.y)
  );
  vPixel = pixel;
  vCoal = vec4(aCoal.xyz, lean);
  vFlame = vec4(w, height, t, reach + abs(lean));
  gl_Position = clipFromCss(pixel, uSize);
}
`;

const COAL_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vPixel;
flat in vec4 vCoal;
flat in vec4 vFlame;
out vec4 outColor;
uniform float uHearth;
${FIRE_RAMP}

// A tapered capsule, round at the base and narrowing to the tip (y up).
float flameDistance(vec2 p, float r1, float r2, float h) {
  p.x = abs(p.x);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(p, vec2(-b, a));
  if (k < 0.0) return length(p) - r1;
  if (k > a * h) return length(p - vec2(0.0, h)) - r2;
  return dot(p, vec2(a, b)) - r1;
}

void main() {
  float w = vFlame.x;
  float h = vFlame.y;
  float level = vCoal.y;
  float flare = vCoal.z;
  vec2 d = vec2(vPixel.x - vCoal.x, uHearth - vPixel.y);
  float v = clamp(d.y / h, 0.0, 1.0);
  // Licks run up the tongue; it leans with the draught, the tip most.
  float lick = 0.6 * sin(v * 7.0 - vFlame.z * 2.3) + 0.4 * sin(v * 12.0 - vFlame.z * 3.7 + 1.3);
  vec2 p = vec2(d.x - vCoal.w * v * v - lick * w * 0.3 * v, d.y - w * 0.7);
  float tip = w * 0.1;
  float dist = flameDistance(p, w, tip, h - w * 0.7 - tip);
  // Soft gas: a feathered body round a hotter core, cooling towards the tip.
  float body = 1.0 - smoothstep(-w * 0.35, w * 0.45, dist);
  float core = 1.0 - smoothstep(-w * 0.75, -w * 0.05, dist);
  float heat = level * (0.62 + 0.38 * core) * (1.0 - 0.55 * v) + flare * 0.3;
  vec3 color = fireColor(heat) * body;
  // The coal, white-hot where it sits on the hearth.
  float cy = d.y - w * 0.25;
  float coal = exp(-(d.x * d.x) / (w * w * 0.8) - cy * cy / (w * w * 0.2));
  color += fireColor(0.7 + 0.3 * level) * coal * level * 0.8;
  // Light thrown round it, gone before the edge of the quad.
  float beyond = max(dist, 0.0) / w;
  float halo = exp(-beyond * beyond * 0.5) * (1.0 - body)
    * (1.0 - smoothstep(0.6, 1.0, abs(d.x) / vFlame.w));
  color += fireColor(0.4 * level + 0.3 * flare) * halo * 0.4;
  outColor = vec4(color, 1.0);
}
`;

const EMBER_VERTEX = `#version 300 es
precision highp float;
in vec4 aMotion;  // origin (css px), initial velocity (css px/s)
in vec4 aTime;    // birth (s, shader clock), life (s), drag (1/s), lift (css px/s^2)
in vec4 aLook;    // radius (css px), heat (above 1: white-hot and brighter), seed, sway 0..1
uniform vec2 uSize;
uniform float uClock;
uniform float uTime;
uniform float uDraught;
uniform float uFlicker;
out vec2 vLocal;
flat out vec3 vColor;
flat out vec2 vShape;  // half length of the motion streak, radius (css px)
${FIRE_RAMP}
${CLIP_FROM_CSS}

// A divergence-free draught: the curl of a few travelling waves.
vec2 draught(vec2 p, float t) {
  vec2 k1 = vec2(0.019, 0.011);
  vec2 k2 = vec2(-0.012, 0.024);
  vec2 k3 = vec2(0.031, -0.017);
  vec2 v = vec2(k1.y, -k1.x) / length(k1) * cos(dot(k1, p) + t * 0.37);
  v += vec2(k2.y, -k2.x) / length(k2) * cos(dot(k2, p) - t * 0.29 + 2.1);
  v += vec2(k3.y, -k3.x) / length(k3) * cos(dot(k3, p) + t * 0.53 + 4.4) * 0.6;
  return v;
}

float wobble(float x) {
  float i = floor(x);
  float f = fract(x);
  float a = fract(sin(i * 12.9898) * 43758.5453);
  float b = fract(sin((i + 1.0) * 12.9898) * 43758.5453);
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}

void main() {
  float age = uClock - aTime.x;
  float life = aTime.y;
  if (age < 0.0 || age >= life) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }
  // Launched against drag, then carried up on the heat: both in closed form.
  float drag = aTime.z;
  float lift = aTime.w;
  float slow = exp(-drag * age);
  float travel = (1.0 - slow) / drag;
  vec2 pos = aMotion.xy + aMotion.zw * travel;
  pos.y -= lift / drag * (age - travel);
  vec2 vel = aMotion.zw * slow - vec2(0.0, lift / drag * (1.0 - slow));

  // Carried sideways on the draught the longer it is aloft, fluttering a
  // little like a flake of ash.
  float seed = aLook.z;
  float sway = aLook.w * uDraught;
  pos += draught(pos + seed * 300.0, uTime) * sway * (age * age / (age + 0.7)) * 16.0;
  pos.x += sin(age * (2.4 + 2.0 * seed) + seed * 6.28) * sway * min(age, 1.0) * 2.2;

  // Cooling as it goes, and out by the end of its life; a spark starts
  // hotter than white and burns brighter while it is.
  float x = age / life;
  float heat = aLook.y * (1.0 - 0.88 * x);
  float flicker = (1.0 - uFlicker * 0.5 * wobble(age * 13.0 + seed * 91.0))
    * (1.0 - smoothstep(0.8, 1.0, x));
  float radius = aLook.x * (1.0 - 0.5 * x);
  float speed = length(vel);
  vec2 dir = speed > 0.001 ? vel / speed : vec2(0.0, -1.0);
  float halfLength = speed * 0.014;
  float reach = radius * 3.5;
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
  vec2 local = vec2(corner.x * (halfLength + reach), corner.y * reach);
  vLocal = local;
  vShape = vec2(halfLength, radius);
  // A streak spreads the same light over more pixels, and so does a big
  // soft ember drifting close by.
  vColor = fireColor(heat) * max(heat, 1.0) * flicker
    * radius / (radius + halfLength * 0.5) * min(1.0, 2.2 / radius);
  gl_Position = clipFromCss(pos + dir * local.x + vec2(-dir.y, dir.x) * local.y, uSize);
}
`;

const EMBER_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec3 vColor;
flat in vec2 vShape;
out vec4 outColor;
void main() {
  float along = clamp(vLocal.x, -vShape.x, vShape.x);
  float d = length(vec2(vLocal.x - along, vLocal.y));
  float r = vShape.y;
  // A fast spark is brightest at its head and thins and fades along its tail.
  float tail = (0.5 - 0.5 * along / max(vShape.x, 0.001)) * min(1.0, vShape.x / r);
  float thin = r * (1.0 - 0.6 * tail);
  float core = exp(-d * d / (thin * thin)) * (1.0 - 0.65 * tail);
  float halo = exp(-d / (r * 1.8)) * 0.3;
  float edge = 1.0 - smoothstep(r * 2.6, r * 3.5, d);
  outColor = vec4(vColor * (core + halo) * edge, 1.0);
}
`;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// A stable 0..1 per integer: embers take their scatter from the note that
// threw them, so the same moment of a piece always throws the same sparks.
const hashUnit = (n) => {
  let x = n | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

// Embers a held coal has shed by `age`: a flurry as it catches, settling to
// a steady rate.
const shedCount = (age, steady, flurry) => (
  steady * age + flurry * SHED_SETTLE_SECONDS * (1 - Math.exp(-age / SHED_SETTLE_SECONDS))
);

function createEmbers(gl) {
  const emptyVao = createEmptyVao(gl);
  const lightPass = createProgram(gl, FULLSCREEN_VERTEX, LIGHT_FRAGMENT, [
    'uSize', 'uHearth', 'uTime', 'uFloor', 'uLaneCount', 'uLanes', 'uNoise'
  ]);
  const backdrop = createProgram(gl, FULLSCREEN_VERTEX, BACKDROP_FRAGMENT, [
    'uLight', 'uRes', 'uDpr', 'uHearth', 'uTime'
  ]);
  const ash = createProgram(gl, ASH_VERTEX, ASH_FRAGMENT, [
    'uSize', 'uPixelsPerSecond', 'uHearth', 'uDpr', 'uTrail', 'uFuse'
  ]);
  const coal = createProgram(gl, COAL_VERTEX, COAL_FRAGMENT, [
    'uSize', 'uHearth', 'uTime', 'uFlicker'
  ]);
  const ember = createProgram(gl, EMBER_VERTEX, EMBER_FRAGMENT, [
    'uSize', 'uClock', 'uTime', 'uDraught', 'uFlicker'
  ]);
  const streaks = createInstances(gl, ash.program, [['aStreak', 4], ['aTrait', 2]], MAX_STREAKS);
  const coals = createInstances(gl, coal.program, [['aCoal', 4], ['aSize', 2]], MAX_LANES);
  const embers = createInstances(
    gl, ember.program, [['aMotion', 4], ['aTime', 4], ['aLook', 4]], MAX_EMBERS
  );
  const light = createTarget(gl, { hdr: true });

  // The smoke's noise, baked once into a tile that wraps.
  const noise = createTarget(gl);
  noise.resize(NOISE_SIZE, NOISE_SIZE);
  gl.bindTexture(gl.TEXTURE_2D, noise.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const bake = createProgram(gl, FULLSCREEN_VERTEX, NOISE_FRAGMENT);
  noise.bind();
  gl.disable(gl.BLEND);
  gl.useProgram(bake.program);
  gl.bindVertexArray(emptyVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteProgram(bake.program);

  const range = { start: 0, end: 0 };
  const onsets = { start: 0, end: 0 };
  const nearby = { start: 0, end: 0 };
  const laneLevel = new Float32Array(MAX_LANES);
  const laneFlare = new Float32Array(MAX_LANES);
  const laneLoud = new Float32Array(MAX_LANES);
  const floorLanes = new Float32Array(MAX_LANES);
  const kernel = new Float32Array(16);
  const emberData = embers.data;
  const emberStride = embers.stride;

  // The ring: the next slot to write and how many were written since the
  // last clear (all of it is drawn once it has wrapped; the dead are culled).
  let head = 0;
  let written = 0;
  let spawned = 0;
  // frame.time at the shader clock's zero.
  let clockBase = 0;
  let lastSongTime = 0;
  let floorLevel = 0;
  // Idle embers let go so far, counted on the wall clock.
  let idleCount = 0;

  const emit = (x, y, vx, vy, birth, life, drag, lift, radius, heat, seed, sway) => {
    if (spawned >= MAX_SPAWN_PER_FRAME) return;
    const o = head * emberStride;
    emberData[o] = x;
    emberData[o + 1] = y;
    emberData[o + 2] = vx;
    emberData[o + 3] = vy;
    emberData[o + 4] = birth;
    emberData[o + 5] = life;
    emberData[o + 6] = drag;
    emberData[o + 7] = lift;
    emberData[o + 8] = radius;
    emberData[o + 9] = heat;
    emberData[o + 10] = seed;
    emberData[o + 11] = sway;
    head = head + 1 === MAX_EMBERS ? 0 : head + 1;
    written += 1;
    spawned += 1;
  };

  // A note catches: sparks shoot up from its place on the hearth, more and
  // faster the louder it is, and a few slower embers linger after them.
  const ignite = (index, x, hearth, birth, loud, crowd, unit, halfWidth) => {
    const sparks = Math.max(1, Math.round((3 + 12 * loud) * crowd));
    for (let j = 0; j < sparks; j += 1) {
      const key = (index * 61 + j) * 9;
      const angle = (hashUnit(key) - 0.5) * 0.6;
      const speed = (0.35 + 0.65 * hashUnit(key + 1)) * (180 + 320 * loud) * unit;
      emit(
        x + (hashUnit(key + 2) - 0.5) * halfWidth,
        hearth - 1,
        Math.sin(angle) * speed,
        -Math.cos(angle) * speed,
        birth + hashUnit(key + 3) * 0.025,
        0.35 + 0.6 * hashUnit(key + 4) * (0.5 + 0.5 * loud),
        2.8 + 1.4 * hashUnit(key + 5),
        35 * unit,
        0.6 + 0.35 * hashUnit(key + 6),
        1.1 + 0.25 * hashUnit(key + 7),
        hashUnit(key + 8),
        0.35
      );
    }
    const lingering = Math.round((1 + 3 * loud) * crowd);
    for (let j = 0; j < lingering; j += 1) {
      const key = (index * 61 + 40 + j) * 9;
      const angle = (hashUnit(key) - 0.5) * 1.2;
      const speed = (0.4 + 0.6 * hashUnit(key + 1)) * (50 + 70 * loud) * unit;
      emit(
        x + (hashUnit(key + 2) - 0.5) * halfWidth,
        hearth - 2,
        Math.sin(angle) * speed,
        -Math.cos(angle) * speed,
        birth + hashUnit(key + 3) * 0.05,
        1.4 + 1.8 * hashUnit(key + 4),
        1.1 + 0.6 * hashUnit(key + 5),
        (30 + 25 * hashUnit(key + 6)) * unit,
        1.0 + 0.9 * hashUnit(key + 7),
        0.82 + 0.12 * hashUnit(key + 8),
        hashUnit(key + 9),
        1
      );
    }
  };

  // A held coal sheds embers on a schedule fixed by the score, so the frame
  // rate never changes how many fly.
  const shed = (note, index, x, from, songTime, clockNow, hearth, loud, unit, halfWidth, rate) => {
    const age0 = Math.max(0, from - note.time);
    const age1 = Math.min(songTime, note.end) - note.time;
    if (age1 <= age0) return;
    const steady = (0.25 + 0.75 * loud) * rate;
    const flurry = 4 * loud * rate;
    const phase = note.seed;
    const n0 = shedCount(age0, steady, flurry) + phase;
    const n1 = shedCount(age1, steady, flurry) + phase;
    for (let k = Math.floor(n0) + 1; k <= n1; k += 1) {
      // When the k-th ember goes: Newton on the shed count, from a straight-line guess.
      let age = age0 + ((k - n0) / (n1 - n0)) * (age1 - age0);
      for (let step = 0; step < 2; step += 1) {
        age -= (shedCount(age, steady, flurry) + phase - k)
          / (steady + flurry * Math.exp(-age / SHED_SETTLE_SECONDS));
      }
      const key = (index * 131 + k) * 11 + 3;
      // One in six drifts close by: bigger, softer, a little cooler.
      const close = hashUnit(key + 9) < 0.16;
      emit(
        x + (hashUnit(key) - 0.5) * halfWidth * 1.2,
        hearth - (4 + 8 * hashUnit(key + 1)) * unit,
        (hashUnit(key + 2) - 0.5) * 16 * unit,
        -(12 + 30 * hashUnit(key + 3)) * unit,
        clockNow - (songTime - (note.time + age)),
        1.6 + 2.2 * hashUnit(key + 4),
        0.8 + 0.4 * hashUnit(key + 5),
        (26 + 26 * hashUnit(key + 6)) * unit,
        (1.1 + 1.1 * hashUnit(key + 7)) * (close ? 2.6 : 1),
        (0.72 + 0.2 * hashUnit(key + 8)) * (close ? 0.85 : 1),
        hashUnit(key + 10),
        1
      );
    }
  };

  // Restart the shader clock: every birth moves by the same amount, so ages stay.
  const rebaseClock = (now) => {
    const shift = now - clockBase;
    const stored = Math.min(written, MAX_EMBERS);
    for (let i = 0; i < stored; i += 1) emberData[i * emberStride + 4] -= shift;
    clockBase = now;
    embers.uploadRange(0, stored);
  };

  const render = (frame) => {
    const { width, height, songTime, notes } = frame;
    const hearth = height - HEARTH_FROM_BOTTOM;
    const unit = clamp(height / 430, 0.45, 1.2);
    const pixelsPerSecond = Math.max(10, (hearth - 4) / AHEAD_SECONDS);
    const laneCount = Math.min(MAX_LANES, frame.high - frame.low + 1);
    const lanePx = laneWidth(frame) * width;
    const halfWidth = clamp(lanePx * 0.28, 1.3, 6.5);
    const calm = frame.reducedMotion;

    if (frame.jumped) {
      head = 0;
      written = 0;
      clockBase = frame.time;
      lastSongTime = songTime;
    }
    if (frame.time - clockBase > CLOCK_REBASE_SECONDS) rebaseClock(frame.time);
    const clock = frame.time - clockBase;
    // Only music moving forward throws sparks; paused, the embers in flight finish.
    const from = lastSongTime;
    const spawning = frame.playing && songTime > from;
    lastSongTime = songTime;
    const firstNew = head;
    spawned = 0;

    // The ash still to fall, and the coals of what sounds or has just stopped.
    laneLevel.fill(0);
    laneFlare.fill(0);
    laneLoud.fill(0);
    visibleRange(frame, RELEASE_SECONDS, AHEAD_SECONDS + 0.25, range);
    const streakData = streaks.data;
    let streakCount = 0;
    for (let index = range.start; index < range.end; index += 1) {
      const note = notes[index];
      const endIn = note.end - songTime;
      if (endIn <= -RELEASE_SECONDS) continue;
      const startIn = note.time - songTime;
      const loud = Math.sqrt(note.velocity);
      const x = pitchX(frame, note.midi) * width;
      if (endIn > 0 && streakCount < MAX_STREAKS) {
        const o = streakCount * streaks.stride;
        streakData[o] = x;
        streakData[o + 1] = startIn;
        streakData[o + 2] = endIn;
        streakData[o + 3] = (0.55 + 0.35 * loud) * clamp(unit, 0.75, 1);
        streakData[o + 4] = loud;
        streakData[o + 5] = note.seed;
        streakCount += 1;
      }
      if (startIn > 0) continue;
      const lane = note.midi - frame.low;
      if (lane < 0 || lane >= laneCount) continue;
      const fade = endIn >= 0 ? 1 : 1 + endIn / RELEASE_SECONDS;
      const level = (0.5 + 0.5 * loud) * fade * fade;
      if (level > laneLevel[lane]) laneLevel[lane] = level;
      const flare = Math.exp(startIn / FLARE_SECONDS) * fade;
      if (flare > laneFlare[lane]) laneFlare[lane] = flare;
      if (loud > laneLoud[lane]) laneLoud[lane] = loud;
      // Every note that sounded since the last frame sheds on its own schedule.
      if (spawning && note.end > from) {
        shed(note, index, x, from, songTime, clock, hearth, loud, unit, halfWidth, calm ? 0.5 : 1);
      }
    }
    streaks.upload(streakCount);

    if (spawning) {
      onsetRange(frame, from, songTime, onsets);
      for (let index = onsets.start; index < onsets.end; index += 1) {
        const note = notes[index];
        // Busy passages and big chords throw fewer sparks a note, counted
        // around the note itself so the frame rate cannot change them.
        onsetRange(frame, note.time - 0.5, note.time + 0.5, nearby);
        const busy = nearby.end - nearby.start;
        onsetRange(frame, note.time - CHORD_SECONDS, note.time + CHORD_SECONDS, nearby);
        const crowd = Math.min(1, Math.sqrt(8 / busy))
          * Math.min(1, Math.sqrt(5 / (nearby.end - nearby.start)))
          * (calm ? 0.4 : 1);
        const x = pitchX(frame, note.midi) * width;
        const birth = clock - (songTime - note.time);
        ignite(index, x, hearth, birth, Math.sqrt(note.velocity), crowd, unit, halfWidth);
      }
    }
    if (!notes.length && !calm) {
      // Only those still in the air: a view hidden for a while owes none.
      const due = Math.floor(frame.time * IDLE_EMBERS_PER_SECOND);
      const first = Math.max(
        idleCount + 1,
        Math.ceil((frame.time - MAX_LIFE) * IDLE_EMBERS_PER_SECOND)
      );
      for (let k = first; k <= due; k += 1) {
        const key = k * 13 + 7;
        emit(
          hashUnit(key) * width,
          hearth - 2,
          (hashUnit(key + 1) - 0.5) * 10 * unit,
          -(8 + 14 * hashUnit(key + 2)) * unit,
          k / IDLE_EMBERS_PER_SECOND - clockBase,
          1.8 + 1.6 * hashUnit(key + 3),
          0.9,
          (18 + 14 * hashUnit(key + 4)) * unit,
          1.1 + 0.8 * hashUnit(key + 5),
          0.62 + 0.16 * hashUnit(key + 6),
          hashUnit(key + 7),
          1
        );
      }
      idleCount = due;
    }
    if (spawned > 0) {
      const untilEnd = Math.min(spawned, MAX_EMBERS - firstNew);
      embers.uploadRange(firstNew, untilEnd);
      if (spawned > untilEnd) embers.uploadRange(0, spawned - untilEnd);
    }

    // One coal per lit pitch; the floor light spreads each sideways.
    const coalData = coals.data;
    let coalCount = 0;
    let activity = 0;
    const spread = Math.max(0.6, 22 / Math.max(1, lanePx));
    const reach = Math.min(kernel.length - 1, Math.ceil(spread * 2.5));
    for (let k = 0; k <= reach; k += 1) kernel[k] = Math.exp(-(k * k) / (2 * spread * spread));
    floorLanes.fill(0);
    for (let lane = 0; lane < laneCount; lane += 1) {
      const level = laneLevel[lane];
      if (level <= 0.003) continue;
      const loud = laneLoud[lane];
      const flare = laneFlare[lane];
      const o = coalCount * coals.stride;
      coalData[o] = ((lane + 0.5) / laneCount) * width;
      coalData[o + 1] = level;
      coalData[o + 2] = flare;
      coalData[o + 3] = hashUnit(lane * 7 + 1);
      const coalWidth = halfWidth * (0.85 + 0.15 * loud);
      coalData[o + 4] = coalWidth;
      coalData[o + 5] = Math.max(
        coalWidth * 2.6,
        ((14 + 20 * loud) * (0.7 + 0.3 * level) + flare * 12) * clamp(unit, 0.5, 1.1)
      );
      coalCount += 1;
      activity += level * (0.5 + 0.5 * loud);
      const first = Math.max(0, lane - reach);
      const last = Math.min(laneCount - 1, lane + reach);
      for (let j = first; j <= last; j += 1) floorLanes[j] += level * kernel[Math.abs(j - lane)];
    }
    for (let lane = 0; lane < laneCount; lane += 1) {
      const sum = floorLanes[lane];
      floorLanes[lane] = sum / (1 + 0.35 * sum);
    }
    coals.upload(coalCount);
    const floorTarget = 1 - Math.exp(-activity / 5);
    floorLevel = frame.jumped
      ? floorTarget
      : floorLevel + (floorTarget - floorLevel)
        * (1 - Math.exp(-frame.dt / (floorTarget > floorLevel ? 0.12 : 0.9)));

    // Smoke and floor light, a quarter size.
    light.bind();
    gl.disable(gl.BLEND);
    gl.useProgram(lightPass.program);
    gl.uniform2f(lightPass.uniforms.uSize, width, height);
    gl.uniform1f(lightPass.uniforms.uHearth, hearth);
    gl.uniform1f(lightPass.uniforms.uTime, calm ? 0 : frame.time);
    gl.uniform1f(lightPass.uniforms.uFloor, floorLevel);
    gl.uniform1f(lightPass.uniforms.uLaneCount, laneCount);
    gl.uniform4fv(lightPass.uniforms.uLanes, floorLanes);
    gl.uniform1i(lightPass.uniforms.uNoise, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noise.texture);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The room: that light over the dark.
    bindCanvas(gl, frame);
    gl.useProgram(backdrop.program);
    gl.uniform1i(backdrop.uniforms.uLight, 0);
    gl.uniform2f(backdrop.uniforms.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(backdrop.uniforms.uDpr, frame.dpr);
    gl.uniform1f(backdrop.uniforms.uHearth, hearth);
    gl.uniform1f(backdrop.uniforms.uTime, calm ? 0 : frame.time);
    gl.bindTexture(gl.TEXTURE_2D, light.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Ash over the room, premultiplied.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(ash.program);
    gl.uniform2f(ash.uniforms.uSize, width, height);
    gl.uniform1f(ash.uniforms.uPixelsPerSecond, pixelsPerSecond);
    gl.uniform1f(ash.uniforms.uHearth, hearth);
    gl.uniform1f(ash.uniforms.uDpr, frame.dpr);
    gl.uniform1f(ash.uniforms.uTrail, 28 * unit);
    gl.uniform1f(ash.uniforms.uFuse, hearth * 0.3);
    if (streakCount > 0) {
      gl.bindVertexArray(streaks.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, streakCount);
    }

    // Fire adds light.
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(coal.program);
    gl.uniform2f(coal.uniforms.uSize, width, height);
    gl.uniform1f(coal.uniforms.uHearth, hearth);
    gl.uniform1f(coal.uniforms.uTime, frame.time);
    gl.uniform1f(coal.uniforms.uFlicker, calm ? 0 : 1);
    coals.draw(coalCount);

    gl.useProgram(ember.program);
    gl.uniform2f(ember.uniforms.uSize, width, height);
    gl.uniform1f(ember.uniforms.uClock, clock);
    gl.uniform1f(ember.uniforms.uTime, frame.time);
    gl.uniform1f(ember.uniforms.uDraught, calm ? 0 : 1);
    gl.uniform1f(ember.uniforms.uFlicker, calm ? 0 : 1);
    embers.draw(Math.min(written, MAX_EMBERS));

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  return {
    resize(frame) {
      light.resize(frame.pixelWidth * LIGHT_SCALE, frame.pixelHeight * LIGHT_SCALE);
    },
    render,
    dispose() {
      streaks.dispose();
      coals.dispose();
      embers.dispose();
      light.dispose();
      noise.dispose();
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(lightPass.program);
      gl.deleteProgram(backdrop.program);
      gl.deleteProgram(ash.program);
      gl.deleteProgram(coal.program);
      gl.deleteProgram(ember.program);
    }
  };
}

export default {
  id: 'embers',
  create: createEmbers
};
