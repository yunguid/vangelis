/**
 * Stars: the score as a long exposure of the night sky. The sky turns about a
 * pole just below the panel and the turning is the music's time: every note
 * is a star whose trail is an arc about that pole, the pitch its radius (low
 * notes near the pole, so low in the panel) and the duration its length. A
 * star rises on the right as a faint, cool thread not yet exposed, flares
 * where it crosses the meridian (now), burns warm white as its trail is
 * exposed there, and sets on the left, cooling as it fades. A distant city
 * stands on the horizon, its haze warm above it.
 *
 * The panel is far wider than it is tall, so the sky is seen through an
 * anamorphic squeeze: orbits are ellipses, stretched just enough that the
 * highest pitches reach the side edges.
 *
 * Five passes a frame: the sky (painted once per size) with the meridian, the
 * background stars, the trails (instanced triangle strips built along their
 * arcs in the vertex shader) and the flares added as light, then the city's
 * roofs again over the stars setting behind them.
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
import { visibleRange } from '../noteFrame.js';

const FULL_TURN = Math.PI * 2;
const DEGREE = Math.PI / 180;
// The lowest pitch rises over the horizon this far from the meridian...
const LOW_RISE_ANGLE = 42 * DEGREE;
// ...this many seconds before it crosses: the sky's turning rate.
const LOW_RISE_SECONDS = 5.25;
const TURN_RATE = LOW_RISE_ANGLE / LOW_RISE_SECONDS;
// The highest pitch comes in over the side edges this far from the meridian:
// wider than the low one, so the arcs keep some of a real sky's curve.
const HIGH_RISE_ANGLE = 60 * DEGREE;
// With no score the sky still turns, slowly, on the wall clock.
const IDLE_TURN_RATE = TURN_RATE * 0.15;
// A trail cools away over this many seconds once its note has ended.
const COOL_SECONDS = 4.5;
// A flare dies this fast once its note has ended.
const FLARE_RELEASE_SECONDS = 0.4;
// Segments along every trail strip.
const SEGMENTS = 48;
// A crowd of notes around one pitch is exposed less, so a dense cluster (a
// drone bed, a tone cluster) does not outshine the melody; the crowd is
// remembered for about as long as a trail takes to cool.
const CROWD_SECONDS = 1.2;
const MAX_TRAILS = 2048;
const MAX_FLARES = 128;
const MAX_STARS = 1200;
// Background stars per 10,000 css px² of sky.
const STAR_DENSITY = 2;

// CSS-pixel coordinates in fragment shaders: origin top left, y down.
const CSS_PIXEL = `
uniform vec2 uRes;
uniform float uDpr;
vec2 cssPixel() {
  return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
}
`;

// A point of an orbit: uPole is (centre x, pole y, horizontal stretch) in css px.
const ORBIT = `
uniform vec2 uSize;
uniform vec3 uPole;
vec2 orbit(float radius, float angle) {
  return vec2(uPole.x + uPole.z * radius * sin(angle), uPole.y - radius * cos(angle));
}
vec4 clipOf(vec2 pixel) {
  return vec4(pixel.x / uSize.x * 2.0 - 1.0, 1.0 - pixel.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

// The sky, painted once per size: the night deepening upwards and a distant
// city on the horizon, its haze warm above it. Alpha is where the city
// stands, so its roofs can be laid back over the trails setting behind them.
const SKY_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
${CSS_PIXEL}
uniform vec3 uPole;
${GLSL_NOISE}

// Blocks of one row of the city, width css px wide and up to tall high.
float blocks(float x, float width, float seed, float tall) {
  float h = hash12(vec2(floor(x / width), seed));
  return tall * (0.25 + 0.75 * h * h);
}

void main() {
  vec2 size = uRes / uDpr;
  vec2 px = cssPixel();
  float down = px.y / size.y;
  vec3 color = mix(vec3(0.020, 0.027, 0.051), vec3(0.051, 0.078, 0.133), down * down);

  // Dusk over the city: warm, patchy, strongest below the pole.
  float above = size.y - px.y;
  float haze = exp(-above / (size.y * 0.13 + 4.0));
  float across = (px.x - uPole.x) / size.x;
  float spread = exp(-across * across * 5.0);
  float patches = 0.65 + 0.7 * fbm(vec2(px.x * 0.012, 3.1));
  color += vec3(0.19, 0.083, 0.03) * haze * (0.45 + 0.55 * spread) * patches;

  // The city: a hazy back row, a darker front row and a few spires, all
  // tallest downtown below the pole.
  float scale = clamp(size.y / 430.0, 0.45, 1.0) * (0.45 + 0.55 * spread);
  float back = blocks(px.x + 5.0, 13.0, 3.0, 9.0 * scale);
  float front = max(blocks(px.x, 7.0, 11.0, 4.5 * scale), blocks(px.x + 2.0, 11.0, 17.0, 3.5 * scale));
  float spireCell = floor(px.x / 23.0);
  float spireAt = fract(px.x / 23.0) * 23.0 - 6.0 - 10.0 * hash12(vec2(spireCell, 29.0));
  float spire = hash12(vec2(spireCell, 23.0)) > 0.8 && abs(spireAt) < 1.4 ? 15.0 * scale : 0.0;
  float edge = 0.6 / uDpr;
  float farCity = smoothstep(-edge, edge, back - above);
  float city = smoothstep(-edge, edge, max(front, spire) - above);
  vec2 cell = floor(px / 2.0);
  float lit = step(0.975, hash12(cell)) * step(1.5, max(front, back) - above);
  vec3 walls = vec3(0.026, 0.027, 0.038);
  color = mix(color, mix(color, walls, 0.72), farCity);
  color = mix(color, walls, city);
  color += vec3(0.5, 0.3, 0.1) * lit * (0.25 + 0.5 * hash12(cell + 7.0)) * max(city, farCity);
  city = max(city, farCity * 0.72);

  // Eight bits are too coarse for so shallow a gradient.
  color += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(color, city);
}
`;

// The sky, then the meridian: a faint thread up from the pole, with a tick at
// every C (a longer one at middle C) while a score is shown.
const BACKDROP_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
${CSS_PIXEL}
uniform sampler2D uSky;
uniform vec4 uMeridian;  // x (css px), how lit (0: no score), pitch at y = 0, pitches per css px
uniform vec2 uBand;      // top and bottom of the pitch lanes (css px)
void main() {
  vec3 color = texelFetch(uSky, ivec2(gl_FragCoord.xy), 0).rgb;
  vec2 px = cssPixel();
  float dx = abs(px.x - uMeridian.x);
  if (dx < 6.0 && uMeridian.y > 0.0) {
    float line = exp(-dx * uDpr * 1.3) * mix(0.35, 1.0, px.y * uDpr / uRes.y);
    float pitch = uMeridian.z - px.y * uMeridian.w;
    float octave = floor(pitch / 12.0 + 0.5) * 12.0;
    float fromTick = abs(pitch - octave) / uMeridian.w;
    float reach = octave == 60.0 ? 5.5 : 3.5;
    float tick = (1.0 - smoothstep(0.3, 0.3 + 0.9 / uDpr, fromTick))
      * (1.0 - smoothstep(reach - 0.6, reach + 0.6, dx))
      * step(uBand.x, px.y) * step(px.y, uBand.y);
    color += vec3(0.07, 0.095, 0.13) * uMeridian.y * (line + 0.9 * tick);
  }
  outColor = vec4(color, 1.0);
}
`;

// The city's roofs again, over the trails that set behind them.
const HORIZON_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uSky;
void main() {
  outColor = texelFetch(uSky, ivec2(gl_FragCoord.xy), 0);
}
`;

const STAR_VERTEX = `#version 300 es
precision highp float;
in vec4 aStar;     // area fraction of the ring, angle (rad), brightness, warmth
in vec2 aTwinkle;  // phase, rate
${ORBIT}
uniform vec2 uRing;     // inner and outer radius, squared
uniform float uTurn;    // how far the sky has turned (rad)
uniform float uTime;
uniform float uTwinkle; // 0 when the listener asked for less motion
out vec2 vOffset;
flat out vec3 vLight;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
  float radius = sqrt(mix(uRing.x, uRing.y, aStar.x));
  vec2 centre = orbit(radius, aStar.y - uTurn);
  float twinkle = 1.0 + uTwinkle * 0.5
    * sin(uTime * aTwinkle.y + aTwinkle.x) * sin(uTime * aTwinkle.y * 0.43 + aTwinkle.x * 3.0);
  // Low stars sink into the haze.
  float clear = smoothstep(uSize.y, uSize.y * 0.78, centre.y);
  vLight = mix(vec3(0.74, 0.82, 1.0), vec3(1.0, 0.84, 0.64), aStar.w) * aStar.z * twinkle * clear;
  vOffset = corner * 2.4;
  gl_Position = clipOf(centre + vOffset);
}
`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vOffset;
flat in vec3 vLight;
out vec4 outColor;
void main() {
  float light = exp(-1.7 * dot(vOffset, vOffset));
  outColor = vec4(vLight * light, 1.0);
}
`;

const TRAIL_VERTEX = `#version 300 es
precision highp float;
in vec4 aArc;   // head and tail angle (rad, > 0 still to come), radius (css px), weight 0..1
in vec2 aNote;  // half-width of the strip where exposed (css px), exposure 0..1
${ORBIT}
out float vAngle;
out float vAcross;
out float vSpeed;
flat out vec4 vArc;  // head, tail, weight, exposure
const int SEGMENTS = ${SEGMENTS};
// Half-width of the strip where the trail is not yet exposed (css px).
const float THREAD = 3.5;

float speedAt(float radius, float angle) {
  return radius * length(vec2(uPole.z * cos(angle), sin(angle)));
}

// Wide enough for the halo left of the meridian, thin for the thread right of it.
float extentAt(float radius, float angle) {
  return angle * speedAt(radius, angle) > 8.0 ? THREAD : aNote.x;
}

void main() {
  float radius = aArc.z;
  // Only the part of the orbit above the horizon and inside the panel is drawn.
  float drop = uPole.y - uSize.y;
  float setting = acos(clamp((drop - aNote.x) / radius, -1.0, 1.0));
  float side = (uSize.x * 0.5 + aNote.x) / (uPole.z * radius);
  float reach = side < 1.0 ? min(setting, asin(side)) : setting;
  float lo = max(aArc.x, -reach);
  float hi = min(aArc.y, reach);
  // Round caps: the strip runs on past each end by its half-width.
  float first = lo - extentAt(radius, lo) / speedAt(radius, lo);
  float last = hi + extentAt(radius, hi) / speedAt(radius, hi);
  // As many segments as the arc's length needs; the rest fold onto its end
  // as empty triangles, so a short note is not shaded as dozens of slivers.
  float span = (last - first) * speedAt(radius, 0.5 * (first + last));
  float needed = clamp(ceil(span / 8.0), 1.0, float(SEGMENTS));
  float column = min(float(gl_VertexID >> 1), needed) / needed;
  float across = float(gl_VertexID & 1) * 2.0 - 1.0;
  float angle = mix(first, last, column);
  vec2 tangent = radius * vec2(uPole.z * cos(angle), sin(angle));
  float speed = length(tangent);
  vec2 normal = vec2(-tangent.y, tangent.x) / speed;
  float extent = extentAt(radius, angle);
  vec2 pixel = orbit(radius, angle) + normal * across * extent;
  vAngle = angle;
  vAcross = across * extent;
  vSpeed = speed;
  vArc = vec4(aArc.x, aArc.y, aArc.w, aNote.y);
  // A trail wholly below the horizon or off the panel collapses to nothing.
  gl_Position = lo > hi ? vec4(2.0, 2.0, 0.0, 1.0) : clipOf(pixel);
}
`;

const TRAIL_FRAGMENT = `#version 300 es
precision highp float;
in float vAngle;
in float vAcross;
in float vSpeed;
flat in vec4 vArc;
out vec4 outColor;
uniform float uTurnRate;
uniform float uDpr;

// Exposed light cooling: warm white, amber, orange, then an ember red.
vec3 cooling(float heat) {
  vec3 color = mix(vec3(0.55, 0.1, 0.07), vec3(0.93, 0.4, 0.1), smoothstep(0.05, 0.32, heat));
  color = mix(color, vec3(0.98, 0.72, 0.3), smoothstep(0.28, 0.5, heat));
  return mix(color, vec3(1.0, 0.94, 0.82), smoothstep(0.48, 0.8, heat));
}

void main() {
  float head = vArc.x;
  float tail = vArc.y;
  float weight = vArc.z;
  float lit = weight * vArc.w;
  float angle = clamp(vAngle, head, tail);
  float dist = length(vec2((vAngle - angle) * vSpeed, vAcross));
  float feather = 0.75 / uDpr;
  // Seconds until this point of the trail crosses the meridian (< 0: it has).
  float toCome = angle / uTurnRate;
  float exposed = smoothstep(0.6, -0.6, angle * vSpeed);
  float nearing = (0.3 + 0.7 * exp(-max(toCome, 0.0) / 2.2)) * smoothstep(10.0, 6.5, toCome);
  float fade = min(1.0, 0.5 + 0.5 * exp(max(toCome, -30.0) / 3.0));
  float cool = exp(-max(0.0, -tail / uTurnRate) / 1.2);
  vec3 light = vec3(0.0);

  // Not yet exposed: a faint, thin, cool thread, clearer as it nears the meridian.
  if (exposed < 1.0) {
    float thread = 1.0 - smoothstep(0.45 - feather, 0.45 + feather, dist);
    light += vec3(0.514, 0.647, 0.72) * thread * nearing * (0.32 + 0.4 * weight) * (1.0 - exposed);
  }

  // Exposed: every point keeps the light its note had when it crossed, bright
  // at the strike and settling as the note is held (so a drone burns low),
  // dims as it ages and cools once the note has ended.
  if (exposed > 0.0) {
    float held = max(0.0, (angle - head) / uTurnRate);
    float hold = mix(1.0, 0.72, 1.0 - exp(-held / 3.0)) * mix(1.0, 0.38, smoothstep(5.0, 30.0, held));
    float heat = hold * fade * cool;
    float width = 0.45 + 0.45 * lit;
    float core = 1.0 - smoothstep(width - feather, width + feather, dist);
    float spread = 1.4 + 1.6 * lit;
    float halo = exp(-dist * dist / (2.0 * spread * spread));
    light += cooling(heat) * heat * (core + 0.25 * heat * halo) * (0.35 + 0.6 * lit) * exposed;
  }

  // The star itself leads its trail, brightest at the strike.
  float fromHead = length(vec2((vAngle - head) * vSpeed, vAcross));
  float star = exp(-fromHead * fromHead / (2.0 * 1.1 * 1.1));
  if (head > 0.0) {
    light += vec3(0.62, 0.74, 0.84) * nearing * (0.28 + 0.36 * weight) * star;
  } else {
    float headHeat = fade * cool;
    light += cooling(headHeat) * headHeat * (0.6 + 0.5 * lit) * star;
  }
  outColor = vec4(light, 1.0);
}
`;

const FLARE_VERTEX = `#version 300 es
precision highp float;
in vec4 aFlare;  // radius (css px), weight, seconds since the note began, since it ended (< 0 while it sounds)
${ORBIT}
out vec2 vOffset;
flat out vec4 vShine;  // core, halo, halo radius, spike length
flat out vec2 vSpikes; // spike light, quad half-size
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
  float weight = aFlare.y;
  float held = aFlare.z;
  float strike = exp(-held / 0.2);
  // A held note settles from a flare into a steady star, and a drone lower still.
  float fresh = exp(-max(0.0, held - 0.3) / 2.5);
  float bed = smoothstep(6.0, 30.0, held);
  float release = aFlare.w > 0.0 ? exp(-aFlare.w / 0.12) : 1.0;
  float level = (0.5 + 0.5 * weight) * (mix(0.7, 0.3, bed) + 0.35 * fresh + 0.9 * strike) * release;
  float haloRadius = (3.5 + 6.5 * weight) * (0.75 + 0.25 * fresh + 0.3 * strike) * (1.0 - 0.5 * bed);
  float spike = (8.0 + 16.0 * weight) * (0.35 + 0.65 * fresh + 0.8 * strike) * (1.0 - 0.6 * bed);
  float extent = max(spike, haloRadius * 3.5) + 1.0;
  vec2 centre = orbit(aFlare.x, 0.0);
  vOffset = corner * extent;
  vShine = vec4(1.3 * level, 0.45 * level, haloRadius, spike);
  vSpikes = vec2(0.6 * level, extent);
  gl_Position = clipOf(centre + vOffset);
}
`;

const FLARE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vOffset;
flat in vec4 vShine;
flat in vec2 vSpikes;
out vec4 outColor;
void main() {
  vec2 p = vOffset;
  float d = length(p);
  float core = exp(-d * d / (2.0 * 1.5 * 1.5));
  // The halo reaches nothing by the quad's edge, so no seams show where flares overlap.
  float halo = exp(-d / vShine.z) * (1.0 - smoothstep(0.45, 1.0, d / vSpikes.y));
  // Four-point diffraction spikes, the vertical a little shorter.
  vec2 reach = max(vec2(0.0), 1.0 - abs(p) / (vec2(1.0, 0.75) * vShine.w + 0.001));
  float spikes = exp(-abs(p.y) * 2.2) * reach.x * reach.x + exp(-abs(p.x) * 2.2) * reach.y * reach.y;
  vec3 light = vec3(1.0, 0.97, 0.9) * core * vShine.x
    + vec3(1.0, 0.76, 0.42) * halo * vShine.y
    + vec3(0.92, 0.94, 1.0) * spikes * vSpikes.x;
  outColor = vec4(light, 1.0);
}
`;

// A small seeded generator, so the background sky is the same on every visit.
const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function createStars(gl) {
  const emptyVao = createEmptyVao(gl);
  const skyProgram = createProgram(gl, FULLSCREEN_VERTEX, SKY_FRAGMENT, ['uRes', 'uDpr', 'uPole']);
  const backdrop = createProgram(gl, FULLSCREEN_VERTEX, BACKDROP_FRAGMENT, [
    'uRes', 'uDpr', 'uSky', 'uMeridian', 'uBand'
  ]);
  const horizon = createProgram(gl, FULLSCREEN_VERTEX, HORIZON_FRAGMENT, ['uSky']);
  const sky = createTarget(gl, { linear: false });
  const starProgram = createProgram(gl, STAR_VERTEX, STAR_FRAGMENT, [
    'uSize', 'uPole', 'uRing', 'uTurn', 'uTime', 'uTwinkle'
  ]);
  const trailProgram = createProgram(gl, TRAIL_VERTEX, TRAIL_FRAGMENT, [
    'uSize', 'uPole', 'uTurnRate', 'uDpr'
  ]);
  const flareProgram = createProgram(gl, FLARE_VERTEX, FLARE_FRAGMENT, ['uSize', 'uPole']);
  const stars = createInstances(gl, starProgram.program, [['aStar', 4], ['aTwinkle', 2]], MAX_STARS);
  const trails = createInstances(gl, trailProgram.program, [['aArc', 4], ['aNote', 2]], MAX_TRAILS);
  const flares = createInstances(gl, flareProgram.program, [['aFlare', 4]], MAX_FLARES);
  const range = { start: 0, end: 0 };
  // Notes sounding at each MIDI pitch now, and the crowd remembered there.
  const crowdNow = new Float32Array(128);
  const crowd = new Float32Array(128);
  // Where the sky sits in the panel; see resize.
  const layout = {
    width: 1,
    height: 1,
    centreX: 0.5,
    poleY: 1,
    stretch: 1,
    inner: 1,
    outer: 1,
    ringInner: 0,
    ringOuter: 1,
    starCount: 0,
    aheadSeconds: LOW_RISE_SECONDS,
    cityHeight: 0
  };

  // The background sky: stars spread evenly over the ring the panel looks into.
  const random = createRandom(0x5eed);
  for (let index = 0; index < MAX_STARS; index += 1) {
    const offset = index * stars.stride;
    const bright = random();
    stars.data[offset] = random();
    stars.data[offset + 1] = random() * FULL_TURN;
    stars.data[offset + 2] = 0.1 + 0.28 * bright * bright + (bright > 0.93 ? 0.35 : 0);
    stars.data[offset + 3] = random() < 0.22 ? 0.4 + 0.6 * random() : 0.15 * random();
    stars.data[offset + 4] = random() * FULL_TURN;
    stars.data[offset + 5] = 0.8 + 2.2 * random();
  }
  stars.upload(MAX_STARS);

  const resize = (frame) => {
    const width = Math.max(1, frame.width);
    const height = Math.max(1, frame.height);
    // The lowest pitch sits `bottom` above the horizon and sets LOW_RISE_ANGLE
    // past the meridian; the pole's drop below the panel follows from that.
    const bottom = Math.max(12, height * 0.08);
    const top = Math.max(10, height * 0.07);
    const cosRise = Math.cos(LOW_RISE_ANGLE);
    const drop = (bottom * cosRise) / (1 - cosRise);
    const inner = drop + bottom;
    const outer = Math.max(inner + 1, drop + height - top);
    // Stretched just enough that the highest pitch leaves by the side edges.
    const stretch = Math.max(1, width / 2 / (outer * Math.sin(HIGH_RISE_ANGLE)));
    const ringOuter = Math.hypot(width / 2 / stretch, drop + height) + 4;
    const ringInner = Math.max(0, drop - 4);
    const ringArea = Math.PI * (ringOuter * ringOuter - ringInner * ringInner) * stretch;
    // The longest any pitch stays up before the meridian, for picking notes.
    let widest = 0;
    for (let step = 0; step <= 16; step += 1) {
      const radius = inner + ((outer - inner) * step) / 16;
      const setting = Math.acos(Math.min(1, drop / radius));
      const side = width / 2 / (stretch * radius);
      widest = Math.max(widest, side < 1 ? Math.min(setting, Math.asin(side)) : setting);
    }
    Object.assign(layout, {
      width,
      height,
      centreX: width / 2,
      poleY: height + drop,
      stretch,
      inner,
      outer,
      ringInner,
      ringOuter,
      starCount: Math.min(MAX_STARS, Math.round((ringArea * STAR_DENSITY) / 10000)),
      aheadSeconds: widest / TURN_RATE + 0.5,
      // The tallest roof the sky shader can draw, and a pixel to spare.
      cityHeight: 15 * Math.min(1, Math.max(0.45, height / 430)) + 1
    });

    sky.resize(frame.pixelWidth, frame.pixelHeight);
    sky.bind();
    gl.disable(gl.BLEND);
    gl.useProgram(skyProgram.program);
    gl.uniform2f(skyProgram.uniforms.uRes, sky.width, sky.height);
    gl.uniform1f(skyProgram.uniforms.uDpr, frame.dpr);
    gl.uniform3f(skyProgram.uniforms.uPole, layout.centreX, layout.poleY, layout.stretch);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const render = (frame) => {
    const { songTime, notes } = frame;
    const hasScore = notes.length > 0;
    // The background turns with the notes, or idly with no score; asked for
    // less motion, it holds still and only the notes move.
    let turn = 0;
    if (!frame.reducedMotion) {
      turn = hasScore ? (songTime * TURN_RATE) % FULL_TURN : (frame.time * IDLE_TURN_RATE) % FULL_TURN;
    }

    let trailCount = 0;
    let flareCount = 0;
    const lane = (layout.outer - layout.inner) / (frame.high - frame.low + 1);
    if (hasScore) {
      visibleRange(frame, COOL_SECONDS, layout.aheadSeconds, range);
      crowdNow.fill(0);
      for (let index = range.start; index < range.end; index += 1) {
        const note = notes[index];
        if (note.time > songTime) break;
        if (note.end > songTime) crowdNow[note.midi] += 1;
      }
      const forget = Math.exp(-frame.dt / CROWD_SECONDS);
      for (let pitch = 0; pitch < 128; pitch += 1) {
        crowd[pitch] = frame.jumped ? crowdNow[pitch] : Math.max(crowdNow[pitch], crowd[pitch] * forget);
      }
      const trailData = trails.data;
      const flareData = flares.data;
      for (let index = range.start; index < range.end; index += 1) {
        const note = notes[index];
        const endIn = note.end - songTime;
        if (endIn < -COOL_SECONDS) continue;
        const startIn = note.time - songTime;
        const pitch = note.midi;
        const radius = layout.inner + (pitch - frame.low + 0.5) * lane;
        const weight = Math.sqrt(note.velocity);
        const near = crowd[pitch]
          + 0.6 * ((pitch > 0 ? crowd[pitch - 1] : 0) + (pitch < 127 ? crowd[pitch + 1] : 0))
          + 0.25 * ((pitch > 1 ? crowd[pitch - 2] : 0) + (pitch < 126 ? crowd[pitch + 2] : 0));
        const exposure = 1 / Math.sqrt(Math.max(1, near));
        if (trailCount < MAX_TRAILS) {
          const offset = trailCount * trails.stride;
          // Angles far past the panel are clamped in the shader; keep them small here.
          trailData[offset] = Math.max(-FULL_TURN, startIn * TURN_RATE);
          trailData[offset + 1] = Math.min(FULL_TURN, endIn * TURN_RATE);
          trailData[offset + 2] = radius;
          trailData[offset + 3] = weight;
          trailData[offset + 4] = 3.5 + 7 * weight * exposure;
          trailData[offset + 5] = exposure;
          trailCount += 1;
        }
        if (startIn <= 0 && endIn > -FLARE_RELEASE_SECONDS && flareCount < MAX_FLARES) {
          const offset = flareCount * flares.stride;
          flareData[offset] = radius;
          flareData[offset + 1] = weight * exposure;
          flareData[offset + 2] = -startIn;
          flareData[offset + 3] = -endIn;
          flareCount += 1;
        }
      }
      trails.upload(trailCount);
      flares.upload(flareCount);
    }

    bindCanvas(gl, frame);
    gl.disable(gl.BLEND);
    gl.useProgram(backdrop.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sky.texture);
    gl.uniform1i(backdrop.uniforms.uSky, 0);
    gl.uniform2f(backdrop.uniforms.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(backdrop.uniforms.uDpr, frame.dpr);
    gl.uniform4f(
      backdrop.uniforms.uMeridian,
      layout.centreX,
      hasScore ? 1 : 0,
      frame.low - 0.5 + (layout.poleY - layout.inner) / lane,
      1 / lane
    );
    gl.uniform2f(backdrop.uniforms.uBand, layout.poleY - layout.outer, layout.poleY - layout.inner);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(starProgram.program);
    gl.uniform2f(starProgram.uniforms.uSize, layout.width, layout.height);
    gl.uniform3f(starProgram.uniforms.uPole, layout.centreX, layout.poleY, layout.stretch);
    gl.uniform2f(
      starProgram.uniforms.uRing,
      layout.ringInner * layout.ringInner,
      layout.ringOuter * layout.ringOuter
    );
    gl.uniform1f(starProgram.uniforms.uTurn, turn);
    gl.uniform1f(starProgram.uniforms.uTime, frame.time);
    gl.uniform1f(starProgram.uniforms.uTwinkle, frame.reducedMotion ? 0 : 1);
    stars.draw(layout.starCount);

    if (trailCount > 0) {
      gl.useProgram(trailProgram.program);
      gl.uniform2f(trailProgram.uniforms.uSize, layout.width, layout.height);
      gl.uniform3f(trailProgram.uniforms.uPole, layout.centreX, layout.poleY, layout.stretch);
      gl.uniform1f(trailProgram.uniforms.uTurnRate, TURN_RATE);
      gl.uniform1f(trailProgram.uniforms.uDpr, frame.dpr);
      gl.bindVertexArray(trails.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * (SEGMENTS + 1), trailCount);
    }
    if (flareCount > 0) {
      gl.useProgram(flareProgram.program);
      gl.uniform2f(flareProgram.uniforms.uSize, layout.width, layout.height);
      gl.uniform3f(flareProgram.uniforms.uPole, layout.centreX, layout.poleY, layout.stretch);
      flares.draw(flareCount);
    }

    // The city stands in front of the stars setting behind it.
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, frame.pixelWidth, Math.ceil(layout.cityHeight * frame.dpr));
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(horizon.program);
    gl.uniform1i(horizon.uniforms.uSky, 0);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  };

  return {
    resize,
    render,
    dispose() {
      stars.dispose();
      trails.dispose();
      flares.dispose();
      sky.dispose();
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(skyProgram.program);
      gl.deleteProgram(backdrop.program);
      gl.deleteProgram(horizon.program);
      gl.deleteProgram(starProgram.program);
      gl.deleteProgram(trailProgram.program);
      gl.deleteProgram(flareProgram.program);
    }
  };
}

export default {
  id: 'stars',
  create: createStars
};
