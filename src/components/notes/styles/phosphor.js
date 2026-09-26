/**
 * Phosphor: the score on an amber vector monitor, like the Esper machine or an
 * early-80s vector arcade. A wireframe highway runs from the front line above
 * the keys to a vanishing point near the top; every note is an outlined box
 * coming down its pitch's lane, as deep as the note is long, reaching the
 * front line as it starts. A sounding box flares and fills and its name lights
 * up under the line in a stroke font; a passed box is gone but for the
 * phosphor it lit.
 *
 * The beam draws into a half-float persistence buffer: red is this frame's
 * beam, green a softer tail that decays with time, so moving lines leave
 * short trails. A quarter-size copy of it is the halation in the glass, and
 * the composite runs the energy through an amber phosphor ramp onto curved,
 * warm, near-black glass with faint scanlines, a vignette, grain and flicker.
 *
 * The notes sit on the GPU a window of the score at a time and the vertex
 * shader moves them with the song clock, so most frames upload nothing. Five
 * draws a frame: the fade, the boxes, the lines and letters, the halation's
 * copy and the composite.
 */
import {
  FULLSCREEN_VERTEX,
  bindCanvas,
  createEmptyVao,
  createInstances,
  createProgram,
  createTarget
} from '../glKit.js';
import { laneWidth, pitchX, visibleRange } from '../noteFrame.js';

// Seconds ahead at which the highway is half as wide as at the front line.
const DEPTH_SCALE = 2.4;
// Seconds of score on the highway; its far end fades into the dark.
const AHEAD_SECONDS = 12;
// The beam loses 1/e of its light every this many seconds out.
const FADE_SECONDS = 6.5;
// The phosphor's tail: how fast it decays and how much of it shows.
const TAIL_SECONDS = 0.2;
const TAIL_WEIGHT = 0.5;
// A struck note flares, then settles over about this long.
const FLASH_SECONDS = 0.14;
// A held note calms over a few seconds and settles further over a long hold;
// notes much longer than DRONE_SECONDS are drones and sit back further, while
// their hits on the front line stay lit.
const HOLD_SECONDS = 2;
const SETTLE_SECONDS = 6;
const DRONE_SECONDS = 8;
// A sounding box's fill fades by 1/e this many seconds up from the front line.
const FILL_SECONDS = 0.9;
// Seconds between the rungs across the highway.
const RUNG_SECONDS = 1;
// With no score the rungs drift this many seconds per second.
const IDLE_DRIFT = 0.3;
// The beam's gaussian sigma, css px.
const BEAM_SIGMA = 0.62;
// Notes held on the GPU at once; the window moves on when the music leaves it.
const NOTE_WINDOW = 1024;
const MAX_LINES = 1024;
const MAX_LANES = 128;
// An RGBA8 fallback holds energy up to 1: it stores it scaled down by this.
const LOW_RANGE = 6;
// A line that never flashes gets a start this far in the past.
const NEVER = -1e4;

// A stroke font for note names on a 4 x 6 grid, y down, drawn as beams the
// way the vector arcades drew their scores.
const GLYPHS = {
  A: [0, 6, 0, 2, 0, 2, 2, 0, 2, 0, 4, 2, 4, 2, 4, 6, 0, 4, 4, 4],
  B: [0, 0, 0, 6, 0, 0, 3, 0, 3, 0, 4, 1.5, 4, 1.5, 3, 3, 0, 3, 3, 3, 3, 3, 4, 4.5, 4, 4.5, 3, 6, 3, 6, 0, 6],
  C: [4, 0, 0, 0, 0, 0, 0, 6, 0, 6, 4, 6],
  D: [0, 0, 0, 6, 0, 0, 2, 0, 2, 0, 4, 2, 4, 2, 4, 4, 4, 4, 2, 6, 2, 6, 0, 6],
  E: [4, 0, 0, 0, 0, 0, 0, 6, 0, 6, 4, 6, 0, 3, 3, 3],
  F: [4, 0, 0, 0, 0, 0, 0, 6, 0, 3, 3, 3],
  G: [4, 0, 0, 0, 0, 0, 0, 6, 0, 6, 4, 6, 4, 6, 4, 4, 4, 4, 2, 4],
  '#': [1, 0.4, 1, 5.6, 3, 0.4, 3, 5.6, 0, 2.4, 4, 1.8, 0, 4.4, 4, 3.8],
  '-': [0.5, 3, 3.5, 3],
  0: [0, 0, 4, 0, 4, 0, 4, 6, 4, 6, 0, 6, 0, 6, 0, 0],
  1: [2, 0, 2, 6, 1, 1, 2, 0],
  2: [0, 0, 4, 0, 4, 0, 4, 3, 4, 3, 0, 3, 0, 3, 0, 6, 0, 6, 4, 6],
  3: [0, 0, 4, 0, 4, 0, 4, 6, 4, 6, 0, 6, 0, 3, 4, 3],
  4: [0, 0, 0, 3, 0, 3, 4, 3, 4, 0, 4, 6],
  5: [4, 0, 0, 0, 0, 0, 0, 3, 0, 3, 4, 3, 4, 3, 4, 6, 4, 6, 0, 6],
  6: [4, 0, 0, 0, 0, 0, 0, 6, 0, 6, 4, 6, 4, 6, 4, 3, 4, 3, 0, 3],
  7: [0, 0, 4, 0, 4, 0, 4, 6],
  8: [0, 0, 4, 0, 4, 0, 4, 6, 4, 6, 0, 6, 0, 6, 0, 0, 0, 3, 4, 3],
  9: [4, 3, 0, 3, 0, 3, 0, 0, 0, 0, 4, 0, 4, 0, 4, 6, 4, 6, 0, 6]
};
const NOTE_LETTERS = 'CCDDEFFGGAAB';
const NOTE_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
// The sharp sits a little smaller than the letters.
const SHARP_SCALE = 0.8;
const LETTER_ADVANCE = 5.5;
const SHARP_ADVANCE = 4.4;

// Every MIDI note's name laid out once, in grid units from the label's top
// left: segments[4 * i ...] for i in [start[midi], start[midi + 1]).
const buildLabels = () => {
  const segments = [];
  const start = new Uint16Array(129);
  const width = new Float32Array(128);
  const place = (glyph, x, scale) => {
    const strokes = GLYPHS[glyph];
    for (let i = 0; i < strokes.length; i += 2) {
      segments.push(x + strokes[i] * scale, strokes[i + 1] * scale);
    }
  };
  for (let midi = 0; midi < 128; midi += 1) {
    start[midi] = segments.length / 4;
    const pitch = midi % 12;
    let x = 0;
    place(NOTE_LETTERS[pitch], x, 1);
    x += LETTER_ADVANCE;
    if (NOTE_SHARP[pitch]) {
      place('#', x, SHARP_SCALE);
      x += SHARP_ADVANCE;
    }
    for (const digit of String(Math.floor(midi / 12) - 1)) {
      place(digit, x, 1);
      x += LETTER_ADVANCE;
    }
    width[midi] = x - (LETTER_ADVANCE - 4);
  }
  start[128] = segments.length / 4;
  return { segments: new Float32Array(segments), start, width };
};
const LABELS = buildLabels();

// uView: the vanishing point's x, the horizon's y and the front line's y (css
// px), and the depth scale (s).
const VIEW = `
uniform vec4 uView;
// Where a point of the highway lands on the glass: x across the front line,
// z seconds ahead of now.
vec2 project(float x, float z) {
  return mix(uView.xy, vec2(x, uView.z), 1.0 / (1.0 + max(z, 0.0) / uView.w));
}
`;

// One beam segment's quad, wide enough for its gaussian's tails. The beam is
// (energy, where it lies, corner dwell, sigma in css px; 0 means a fill);
// where it lies is 0 on the glass, 1 on the highway, 2 on the highway as an
// edge moving across itself, whose tail is drawn wider.
const BEAM_QUAD = `
uniform vec2 uSize;
out vec2 vPixel;
flat out vec4 vSeg;   // one end (css px) and the direction to the other
flat out float vLength;
flat out vec4 vBeam;

vec4 clipOf(vec2 pixel) {
  return vec4(pixel.x / uSize.x * 2.0 - 1.0, 1.0 - pixel.y / uSize.y * 2.0, 0.0, 1.0);
}

void emitBeam(vec2 a, vec2 b, vec2 corner, vec4 beam) {
  vec2 d = b - a;
  float len = length(d);
  vec2 u = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-u.y, u.x);
  float reach = beam.w * (beam.y > 1.5 ? 6.4 : 3.4) + 0.6;
  vec2 pixel = mix(a - u * reach, b + u * reach, corner.x) + n * (reach * (corner.y * 2.0 - 1.0));
  vPixel = pixel;
  vSeg = vec4(a, u);
  vLength = len;
  vBeam = beam;
  gl_Position = clipOf(pixel);
}
`;

const BOX_VERTEX = `#version 300 es
precision highp float;
in vec4 aNote;   // pitch across the front line (0..1), start and end (s), velocity
in vec2 aTrait;  // how far a long hold sits back, 1 for a doubled note
uniform vec3 uBox;  // song seconds, half width (css px), dimming for thin lanes
uniform float uSigma;
${VIEW}
${BEAM_QUAD}
const vec2 CORNERS[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0)
);

void main() {
  float startIn = aNote.y - uBox.x;
  float endIn = aNote.z - uBox.x;
  if (endIn <= 0.0 || startIn > ${AHEAD_SECONDS.toFixed(1)} || aTrait.y > 0.5) {
    // Passed, not in sight yet, or drawn already by its twin.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float velocity = aNote.w;
  // The outline's, the front edge's and the fill's energy, and how far the
  // front edge flares along the front line.
  vec4 look;
  if (startIn <= 0.0) {
    float flash = exp(startIn / ${FLASH_SECONDS.toFixed(3)});
    float fresh = exp(startIn / ${HOLD_SECONDS.toFixed(3)});
    float settle = exp(startIn / ${SETTLE_SECONDS.toFixed(3)});
    float hold = (0.2 + 0.1 * velocity + (0.5 + 0.2 * velocity) * settle) * aTrait.x;
    look = vec4(
      (hold + (0.9 + 0.5 * velocity) * fresh + 4.0 * flash) * uBox.z,
      2.2 + 0.8 * velocity + 5.0 * flash,
      0.08 + (0.1 + 0.1 * velocity) * fresh + 0.9 * flash,
      1.0 + 1.6 * flash
    );
  } else {
    // Brightening as it closes on the front line.
    float outline = (0.5 + 0.7 * velocity) * (1.6 - 0.6 * smoothstep(0.0, 0.7, startIn)) * uBox.z;
    look = vec4(outline, outline, 0.0, 1.0);
  }

  float centre = aNote.x * uSize.x;
  float near = max(startIn, 0.0);
  float far = min(endIn, ${(AHEAD_SECONDS + 1).toFixed(1)});
  int quad = gl_VertexID / 6;
  vec2 corner = CORNERS[gl_VertexID - quad * 6];
  if (quad < 4) {
    // The front, back, left and right edges.
    float span = quad == 0 ? uBox.y * look.w : uBox.y;
    float x0 = centre - span;
    float x1 = centre + span;
    vec2 a = project(quad == 3 ? x1 : x0, quad == 1 ? far : near);
    vec2 b = project(quad == 2 ? x0 : x1, quad == 0 ? near : far);
    // Near the front line the front and back edges move fast enough to
    // strobe: their tails are drawn wider there.
    float place = quad < 2 && (quad == 0 ? near : far) < 1.5 ? 2.0 : 1.0;
    emitBeam(a, b, corner, vec4(quad == 0 ? look.y : look.x, place, 0.3, uSigma));
    return;
  }
  // The fill, only while the note sounds: the box's own trapezoid, as far up
  // as its light reaches.
  float lit = min(far, ${(3 * FILL_SECONDS).toFixed(3)});
  vec2 pixel = project(mix(centre - uBox.y, centre + uBox.y, corner.x), mix(near, lit, corner.y));
  vPixel = pixel;
  vSeg = vec4(0.0);
  vLength = 0.0;
  vBeam = vec4(look.z, 1.0, 0.0, 0.0);
  gl_Position = look.z > 0.0 ? clipOf(pixel) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const LINE_VERTEX = `#version 300 es
precision highp float;
in vec4 aEnds;  // two ends: css px on the glass, or (x on the front line, depth s) on the highway
in vec4 aBeam;  // energy, where it lies (0 glass, 1 highway, 3 a rung), the start it flares from (s), sigma
uniform vec2 uClock;  // song seconds, how far the rungs have come (s)
${VIEW}
${BEAM_QUAD}
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  vec2 a = aEnds.xy;
  vec2 b = aEnds.zw;
  float energy = aBeam.x;
  float place = aBeam.y;
  if (place > 2.5) {
    // A rung comes down the highway with the song and goes round again.
    float z = a.y - mod(uClock.y, ${RUNG_SECONDS.toFixed(3)});
    energy *= smoothstep(0.15, 0.95, z);
    a.y = z;
    b.y = z;
    place = 1.0;
  }
  if (place > 0.5) {
    a = project(a.x, a.y);
    b = project(b.x, b.y);
  }
  // A name flares as its note strikes.
  energy += 2.0 * exp(min(aBeam.z - uClock.x, 0.0) / ${FLASH_SECONDS.toFixed(3)});
  emitBeam(a, b, corner, vec4(energy, place, 0.0, aBeam.w));
}
`;

const BEAM_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vPixel;
flat in vec4 vSeg;
flat in float vLength;
flat in vec4 vBeam;
uniform vec4 uView;
uniform vec2 uDeposit;  // this frame's share, the tail's share
uniform vec4 uQuiet;    // a dimmed ellipse (centre, radii) for the empty panel's message
out vec4 outColor;

void main() {
  // Seconds ahead of the front line at this height.
  float s = clamp((vPixel.y - uView.y) / (uView.z - uView.y), 1e-3, 1.0);
  float z = uView.w * (1.0 / s - 1.0);
  float energy = vBeam.x;
  float sigma = vBeam.w;
  // How this frame's beam and the tail it leaves fall off around the segment.
  float now = 1.0;
  float tail = 1.0;
  if (sigma > 0.0) {
    // A gaussian across the segment; its ends ramp so that segments meeting
    // end to end draw one even line.
    vec2 ap = vPixel - vSeg.xy;
    float along = dot(ap, vSeg.zw);
    float across = ap.y * vSeg.z - ap.x * vSeg.w;
    float k = 0.5 / (sigma * sigma);
    float w = sigma * 1.25;
    float line = exp(-across * across * k) * smoothstep(-w, w, along) * smoothstep(-w, w, vLength - along);
    // The beam lingers a moment on each corner.
    float dwell = 0.0;
    if (vBeam.z > 0.0) {
      vec2 bp = ap - vSeg.zw * vLength;
      dwell = vBeam.z * (exp(-dot(ap, ap) * k) + exp(-dot(bp, bp) * k));
    }
    now = line + dwell;
    tail = now;
    // An edge moving across itself leaves its tail from a beam twice as
    // wide, so it smears instead of strobing.
    if (vBeam.y > 1.5) {
      tail = exp(-across * across * k * 0.25) * smoothstep(-w * 2.0, w * 2.0, along)
        * smoothstep(-w * 2.0, w * 2.0, vLength - along) + dwell;
    }
  } else {
    // A fill is lit from the front line, fading up the box.
    energy *= exp(-z / ${FILL_SECONDS.toFixed(3)});
  }
  // Lines on the highway fade with distance; names on the glass barely persist.
  if (vBeam.y > 0.5) {
    energy *= exp(-z / ${FADE_SECONDS.toFixed(3)})
      * (1.0 - smoothstep(${(AHEAD_SECONDS * 0.6).toFixed(3)}, ${AHEAD_SECONDS.toFixed(3)}, z));
  } else {
    tail *= 0.3;
  }
  if (uQuiet.z > 0.0) {
    vec2 q = (vPixel - uQuiet.xy) / uQuiet.zw;
    energy *= 1.0 - 0.85 * exp(-2.0 * dot(q, q));
  }
  outColor = vec4(energy * now * uDeposit.x, energy * tail * 0.5 * uDeposit.y, 0.0, 0.0);
}
`;

// Multiplied into the buffer by the blend: red (this frame) goes, green (the
// tail) keeps its share; uFloor is subtracted where 8 bits would never reach 0.
const FADE_FRAGMENT = `#version 300 es
precision highp float;
uniform float uFloor;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, uFloor, 0.0, 0.0);
}
`;

// A quarter-size copy of the energy for the halation: nine bilinear taps
// weigh the 6 x 6 texels around each one as a tent, so no thin line slips
// between them and the halo stays smooth.
const DOWN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec2 sum = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float weight = float((2 - abs(x)) * (2 - abs(y)));
      sum += texture(uSource, vUv + vec2(x, y) * 2.0 * uTexel).rg * weight;
    }
  }
  outColor = vec4((sum.r + sum.g * ${TAIL_WEIGHT.toFixed(3)}) / 16.0, 0.0, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPersist;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uLook;     // beam gain (flicker, store scale), bloom gain, front line (0..1 up), time
uniform vec2 uBloomTexel;
uniform float uMotion;  // 0 under reduced motion: the grain holds still
out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 c = uv * 2.0 - 1.0;
  // The tube's face bulges: lines bow out towards the edges, while the front
  // line keeps its pitches where they are.
  float fromFront = c.y - (uLook.z * 2.0 - 1.0);
  vec2 q = c * vec2(1.0 + 0.03 * fromFront * fromFront, 1.0 + 0.028 * c.x * c.x);
  vec2 st = q * 0.5 + 0.5;
  vec2 beam = texture(uPersist, st).rg;
  // The halation: the quarter-size copy through five overlapping bilinear taps.
  vec2 bt = uBloomTexel;
  float halo = texture(uBloom, st).r
    + texture(uBloom, st + vec2(1.8, 0.6) * bt).r + texture(uBloom, st + vec2(-0.6, 1.8) * bt).r
    + texture(uBloom, st + vec2(-1.8, -0.6) * bt).r + texture(uBloom, st + vec2(0.6, -1.8) * bt).r;
  float energy = beam.r + beam.g * ${TAIL_WEIGHT.toFixed(3)} + halo * 0.2 * uLook.y;
  vec2 edge = smoothstep(vec2(0.0), vec2(2.0) / uRes, st) * smoothstep(vec2(0.0), vec2(2.0) / uRes, 1.0 - st);
  energy *= uLook.x * edge.x * edge.y;

  // Amber phosphor: red saturates first, then green, then blue, so the ramp
  // runs deep amber, orange, yellow and on to white where the beam is hot.
  vec3 light = 1.0 - exp(-energy * vec3(1.0, 0.5, 0.17));
  // Faint scanlines two css px apart, bowed with the face.
  light *= 0.9 + 0.1 * cos(st.y * uRes.y / uDpr * 3.14159265);

  // Warm near-black glass with a soft reflection up to the left.
  vec3 glass = vec3(0.03, 0.024, 0.02);
  vec2 sheen = (uv - vec2(0.2, 1.08)) * vec2(1.5, 2.6);
  glass += vec3(0.05, 0.036, 0.024) * exp(-2.0 * dot(sheen, sheen));
  float vignette = (1.0 - 0.45 * pow(abs(c.x), 9.0)) * (1.0 - 0.5 * pow(abs(c.y), 14.0));
  vec3 color = (glass + light) * vignette;
  color += (hash12(gl_FragCoord.xy + fract(uLook.w * 7.31) * 511.0 * uMotion) - 0.5) * 0.012;
  outColor = vec4(color, 1.0);
}
`;

// The persistence buffer needs two channels (this frame, the tail): RG16F
// moves half the bytes of RGBA16F through the passes that touch every pixel.
// Without float rendering the shared target stands in (RGBA16F or RGBA8).
const createPersistTarget = (gl) => {
  if (!gl.getExtension('EXT_color_buffer_float')) return createTarget(gl, { hdr: true });
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const target = {
    texture,
    framebuffer,
    width: 0,
    height: 0,
    hdr: true,
    resize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (w === target.width && h === target.height) return;
      target.width = w;
      target.height = h;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, w, h, 0, gl.RG, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    },
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, target.width, target.height);
    },
    dispose() {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
    }
  };
  return target;
};

function createPhosphor(gl) {
  const emptyVao = createEmptyVao(gl);
  const boxProgram = createProgram(gl, BOX_VERTEX, BEAM_FRAGMENT, [
    'uSize', 'uView', 'uBox', 'uSigma', 'uDeposit', 'uQuiet'
  ]);
  const lineProgram = createProgram(gl, LINE_VERTEX, BEAM_FRAGMENT, [
    'uSize', 'uView', 'uClock', 'uDeposit', 'uQuiet'
  ]);
  const fade = createProgram(gl, FULLSCREEN_VERTEX, FADE_FRAGMENT, ['uFloor']);
  const down = createProgram(gl, FULLSCREEN_VERTEX, DOWN_FRAGMENT, ['uSource', 'uTexel']);
  const composite = createProgram(gl, FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT, [
    'uPersist', 'uBloom', 'uRes', 'uDpr', 'uLook', 'uBloomTexel', 'uMotion'
  ]);
  const boxes = createInstances(gl, boxProgram.program, [['aNote', 4], ['aTrait', 2]], NOTE_WINDOW);
  const lines = createInstances(gl, lineProgram.program, [['aEnds', 4], ['aBeam', 4]], MAX_LINES);
  const persist = createPersistTarget(gl);
  const bloom = createTarget(gl, { hdr: true });
  // Half floats hold the energy as it is; 8 bits hold it divided by this.
  const storeScale = persist.hdr ? 1 : LOW_RANGE;

  gl.useProgram(down.program);
  gl.uniform1i(down.uniforms.uSource, 0);
  gl.useProgram(composite.program);
  gl.uniform1i(composite.uniforms.uPersist, 0);
  gl.uniform1i(composite.uniforms.uBloom, 1);
  gl.useProgram(null);

  const visible = { start: 0, end: 0 };
  // The window of notes on the GPU: every note starting before `until` that
  // had not ended when it was packed.
  const loaded = { scoreId: -1, from: 0, until: 0, count: 0 };
  const loadedStarts = new Float64Array(NOTE_WINDOW);
  // Which lanes sound (their loudest velocity, their latest start), and the
  // same as the names on the GPU show them.
  const laneLevel = new Float32Array(MAX_LANES);
  const laneStart = new Float32Array(MAX_LANES);
  const shownLevel = new Float32Array(MAX_LANES);
  const shownStart = new Float32Array(MAX_LANES);
  // The highway's fixed lines (with its rungs) sit first in the line buffer,
  // redrawn when the size or the pitch span changes; the names follow.
  const highway = { count: 0, width: -1, height: -1, low: -1, high: -1 };
  let nameCount = 0;
  let namesStale = true;
  const lineData = lines.data;
  const noteData = boxes.data;

  const pushLine = (index, x0, y0, x1, y1, energy, place, start, sigma) => {
    if (index >= MAX_LINES) return index;
    const offset = index * lines.stride;
    lineData[offset] = x0;
    lineData[offset + 1] = y0;
    lineData[offset + 2] = x1;
    lineData[offset + 3] = y1;
    lineData[offset + 4] = energy;
    lineData[offset + 5] = place;
    lineData[offset + 6] = start;
    lineData[offset + 7] = sigma;
    return index + 1;
  };

  const buildHighway = (frame, frontY) => {
    const { width, low, high } = frame;
    const span = high - low + 1;
    let count = 0;
    count = pushLine(count, 0, 0, width, 0, 0.62, 1, NEVER, BEAM_SIGMA);
    count = pushLine(count, 0, 0, 0, AHEAD_SECONDS, 0.42, 1, NEVER, BEAM_SIGMA);
    count = pushLine(count, width, 0, width, AHEAD_SECONDS, 0.42, 1, NEVER, BEAM_SIGMA);
    // A lane line up the highway at every C clear of the edges, and a tick
    // under the front line.
    for (let midi = low + 1; midi <= high; midi += 1) {
      const x = ((midi - low) / span) * width;
      if (midi % 12 !== 0 || x < width * 0.04 || x > width * 0.96) continue;
      count = pushLine(count, x, 0, x, AHEAD_SECONDS, 0.26, 1, NEVER, BEAM_SIGMA);
      count = pushLine(count, x, frontY, x, frontY + 3.5, 0.5, 0, NEVER, BEAM_SIGMA * 0.9);
    }
    // Rungs across the highway, one every RUNG_SECONDS; the shader moves them.
    for (let z = RUNG_SECONDS; z <= AHEAD_SECONDS; z += RUNG_SECONDS) {
      count = pushLine(count, 0, z, width, z, 0.12, 3, NEVER, BEAM_SIGMA);
    }
    lines.uploadRange(0, count);
    highway.count = count;
    highway.width = width;
    highway.height = frame.height;
    highway.low = low;
    highway.high = high;
    namesStale = true;
  };

  // Packs the notes that may show from now on into the GPU window: those
  // still sounding or to come, up to the window's size.
  const loadNotes = (frame, first) => {
    const { notes, songTime } = frame;
    let count = 0;
    let previous = null;
    let index = first;
    for (; index < notes.length && count < NOTE_WINDOW; index += 1) {
      const note = notes[index];
      if (note.end <= songTime) continue;
      const offset = count * boxes.stride;
      noteData[offset] = pitchX(frame, note.midi);
      noteData[offset + 1] = note.time;
      loadedStarts[count] = note.time;
      noteData[offset + 2] = note.end;
      noteData[offset + 3] = note.velocity;
      noteData[offset + 4] = 0.3 + 0.7 * Math.min(1, DRONE_SECONDS / note.duration);
      // Doubled notes (the same pitch, start and end) are drawn once.
      noteData[offset + 5] = previous !== null && previous.midi === note.midi
        && previous.time === note.time && previous.end === note.end ? 1 : 0;
      previous = note;
      count += 1;
    }
    boxes.upload(count);
    loaded.scoreId = frame.scoreId;
    loaded.from = songTime;
    // Every note starting before this is in the window.
    loaded.until = index < notes.length ? notes[index].time : Infinity;
    loaded.count = count;
  };

  // How many of the window's notes start by `time` (they are in time order).
  const loadedBy = (time) => {
    let low = 0;
    let high = loaded.count;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (loadedStarts[mid] <= time) low = mid + 1;
      else high = mid;
    }
    return low;
  };

  // The sounding notes' names under the front line, left to right, each
  // under its lane unless its left neighbour's name is in the way.
  const buildNames = (frame, frontY, gap, laneCount) => {
    const { width } = frame;
    const capHeight = Math.min(10, gap * 0.38);
    const unit = capHeight / 6;
    const top = frontY + (gap - capHeight) * 0.55;
    const sigma = Math.min(BEAM_SIGMA, unit * 0.36);
    const segments = LABELS.segments;
    let count = highway.count;
    let cursor = -1e9;
    for (let lane = 0; lane < laneCount; lane += 1) {
      const level = laneLevel[lane];
      if (level <= 0) continue;
      const midi = frame.low + lane;
      const labelWidth = LABELS.width[midi] * unit;
      const centred = pitchX(frame, midi) * width - labelWidth * 0.5;
      let left = Math.max(centred, cursor + unit * 5);
      // In a cluster, a name pushed far from its lane is left out.
      if (left - centred > labelWidth * 0.4) continue;
      if (left > width - labelWidth - 2) left = width - labelWidth - 2;
      if (left < 2) left = 2;
      const energy = 1.9 + 0.5 * level;
      for (let i = LABELS.start[midi] * 4, end = LABELS.start[midi + 1] * 4; i < end; i += 4) {
        count = pushLine(
          count,
          left + segments[i] * unit, top + segments[i + 1] * unit,
          left + segments[i + 2] * unit, top + segments[i + 3] * unit,
          energy, 0, laneStart[lane], sigma
        );
      }
      cursor = left + labelWidth;
    }
    nameCount = count - highway.count;
    lines.uploadRange(highway.count, nameCount);
  };

  const render = (frame) => {
    const { width, height, songTime, notes } = frame;
    const hasScore = notes.length > 0;
    // The strip under the front line, for the names.
    const gap = Math.min(28, Math.max(17, height * 0.062));
    const frontY = height - gap;
    const horizonY = height * 0.045;
    const laneCount = Math.min(MAX_LANES, frame.high - frame.low + 1);
    const boxHalf = Math.max(1.1, laneWidth(frame) * width * 0.34);
    // Narrow lanes bring a box's sides together: dimmed, so dense pieces on
    // small screens do not merge into slabs.
    const thin = Math.min(1, Math.max(0.5, boxHalf / 4));
    if (
      width !== highway.width || height !== highway.height
      || frame.low !== highway.low || frame.high !== highway.high
    ) buildHighway(frame, frontY);

    // The notes on the GPU, and which lanes sound.
    laneLevel.fill(0);
    laneStart.fill(NEVER);
    if (hasScore) {
      visibleRange(frame, 0, AHEAD_SECONDS, visible);
      if (
        frame.scoreId !== loaded.scoreId || songTime < loaded.from
        || songTime + AHEAD_SECONDS >= loaded.until
      ) loadNotes(frame, visible.start);
      for (let index = visible.start; index < visible.end; index += 1) {
        const note = notes[index];
        if (note.time > songTime) break;
        const lane = note.midi - frame.low;
        if (note.end <= songTime || lane < 0 || lane >= laneCount) continue;
        if (note.velocity + 0.01 > laneLevel[lane]) laneLevel[lane] = note.velocity + 0.01;
        if (note.time > laneStart[lane]) laneStart[lane] = note.time;
      }
    }
    for (let lane = 0; lane < MAX_LANES; lane += 1) {
      if (laneLevel[lane] !== shownLevel[lane] || laneStart[lane] !== shownStart[lane]) {
        namesStale = true;
        shownLevel[lane] = laneLevel[lane];
        shownStart[lane] = laneStart[lane];
      }
    }
    if (namesStale) {
      buildNames(frame, frontY, gap, laneCount);
      namesStale = false;
    }

    // 1. Fade the phosphor: this frame's beam goes, the tail decays.
    const tailKeep = Math.exp(-frame.dt / TAIL_SECONDS);
    persist.bind();
    gl.bindVertexArray(emptyVao);
    gl.disable(gl.SCISSOR_TEST);
    if (frame.jumped) {
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.CONSTANT_COLOR);
      gl.blendColor(0, tailKeep, 0, 0);
      gl.useProgram(fade.program);
      gl.uniform1f(fade.uniforms.uFloor, persist.hdr ? 0 : 1.5 / 255);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. The beam, added on: the boxes, then the highway, rungs and names.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    const nowShare = 1 / storeScale;
    const tailShare = (1 - tailKeep) / storeScale;
    const quietW = hasScore ? 0 : Math.min(width * 0.26, 240);
    const quietH = hasScore ? 1 : Math.min(height * 0.2, 60);
    const boxCount = hasScore ? loadedBy(songTime + AHEAD_SECONDS) : 0;
    if (boxCount > 0) {
      gl.useProgram(boxProgram.program);
      gl.uniform2f(boxProgram.uniforms.uSize, width, height);
      gl.uniform4f(boxProgram.uniforms.uView, width * 0.5, horizonY, frontY, DEPTH_SCALE);
      gl.uniform3f(boxProgram.uniforms.uBox, songTime, boxHalf, thin);
      gl.uniform1f(boxProgram.uniforms.uSigma, BEAM_SIGMA);
      gl.uniform2f(boxProgram.uniforms.uDeposit, nowShare, tailShare);
      gl.uniform4f(boxProgram.uniforms.uQuiet, 0, 0, 0, 1);
      gl.bindVertexArray(boxes.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 30, boxCount);
    }
    let rungClock = songTime;
    if (!hasScore) rungClock = frame.reducedMotion ? 0 : frame.time * IDLE_DRIFT;
    gl.useProgram(lineProgram.program);
    gl.uniform2f(lineProgram.uniforms.uSize, width, height);
    gl.uniform4f(lineProgram.uniforms.uView, width * 0.5, horizonY, frontY, DEPTH_SCALE);
    gl.uniform2f(lineProgram.uniforms.uClock, songTime, rungClock);
    gl.uniform2f(lineProgram.uniforms.uDeposit, nowShare, tailShare);
    gl.uniform4f(lineProgram.uniforms.uQuiet, width * 0.5, height * 0.5, quietW, quietH);
    lines.draw(highway.count + nameCount);
    gl.disable(gl.BLEND);

    // 3. The halation's copy. This pass and the next cover every pixel, so
    // clearing first spares the GPU loading what was there.
    bloom.bind();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(down.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, persist.texture);
    gl.uniform2f(down.uniforms.uTexel, 1 / persist.width, 1 / persist.height);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Onto the glass.
    bindCanvas(gl, frame);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(composite.program);
    gl.bindTexture(gl.TEXTURE_2D, persist.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
    gl.activeTexture(gl.TEXTURE0);
    const t = frame.time;
    const flicker = frame.reducedMotion ? 1 : 1 + 0.02 * Math.sin(t * 43.7) * Math.sin(t * 5.9 + 1.3);
    gl.uniform2f(composite.uniforms.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(composite.uniforms.uDpr, frame.dpr);
    gl.uniform4f(composite.uniforms.uLook, flicker * storeScale, 0.9, 1 - frontY / height, t);
    gl.uniform2f(composite.uniforms.uBloomTexel, 1 / bloom.width, 1 / bloom.height);
    gl.uniform1f(composite.uniforms.uMotion, frame.reducedMotion ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  return {
    resize(frame) {
      persist.resize(frame.pixelWidth, frame.pixelHeight);
      bloom.resize(Math.ceil(frame.pixelWidth / 4), Math.ceil(frame.pixelHeight / 4));
    },
    render,
    dispose() {
      boxes.dispose();
      lines.dispose();
      persist.dispose();
      bloom.dispose();
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(boxProgram.program);
      gl.deleteProgram(lineProgram.program);
      gl.deleteProgram(fade.program);
      gl.deleteProgram(down.program);
      gl.deleteProgram(composite.program);
    }
  };
}

export default {
  id: 'phosphor',
  create: createPhosphor
};
