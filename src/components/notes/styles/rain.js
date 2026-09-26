/**
 * Rain: night rain on a still pond, every note a raindrop. Each drop falls at
 * its pitch towards a point on the water and meets it as the note starts; the
 * landing rings out across the surface, and a held note keeps dripping into
 * its own rings until it ends. A lamp on the far bank lights the drizzle and
 * lays a wavering path of light on the water that the rings break up.
 *
 * The water is seen from a low camera looking level at the horizon: a pixel
 * below it at depth d (css px) is the point (x - centre, focal) / d on the
 * pond, in camera heights. Every ring lives in those pond units, so it spreads
 * as a squashed ellipse, and a drop's streak and its reflection meet exactly
 * where its rings start.
 *
 * Four passes a frame: the ripple field (the slopes of up to 48 ring sources,
 * summed at reduced resolution, each texel visiting only the sources its tile
 * lists), the scene (a sky baked once per size and a mist tile baked once,
 * the water shaded from the field and reflecting that sky), the splashes and
 * sounding sources (instanced sprites) and the falling drops with their
 * reflections (instanced streaks).
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
import { onsetRange, pitchX, visibleRange } from '../noteFrame.js';

// The horizon, as a fraction of the height from the top.
const HORIZON = 0.3;
// How round a ring looks at the near edge of the water (1 would be a circle).
const NEAR_SQUASH = 0.5;
// Where drops may land: fractions of the water between the horizon and the near edge.
const LAND_FAR = 0.24;
const LAND_NEAR = 0.93;
// Seconds a drop takes to fall from the top edge to the water, and where it starts (css px).
const FALL_SECONDS = 1.8;
const FALL_FROM = -12;
// Motion blur: a streak is as long as its drop moves in this many seconds.
const EXPOSURE = 0.16;
// A held note drips about this often (each note a little faster or slower).
const DRIP_SECONDS = 0.35;
// A drip's share of its note's landing. A long note settles: t seconds in,
// its drips and light are SETTLED + (1 - SETTLED) * exp(-t / SETTLE_SECONDS)
// of a fresh note's (written out where used, so hot loops box no numbers).
const DRIP_SHARE = 0.45;
const SETTLE_SECONDS = 2.5;
const SETTLED = 0.35;
// A landing's flash and crown of droplets last this long.
const SPLASH_SECONDS = 0.4;
// A released note's light fades over this long.
const RELEASE_SECONDS = 0.45;
// Rings: speed in camera heights per second, carrier in rad/s, the wave
// packet's half-width, the amplitude's e-folding time, when to drop it and
// the steepest slope a landing makes.
const RING_SPEED = 0.3;
const RING_OMEGA = 35;
const PACKET_SECONDS = 0.14;
// Beyond this many seconds from its centre a packet is too small to see.
const PACKET_SPAN = PACKET_SECONDS * 2.2;
const RING_LIFE = 0.75;
const RING_REACH = 2.4;
const RING_SLOPE = 0.34;
const MAX_SOURCES = 48;
const MAX_STREAKS = 1024;
const MAX_SPRITES = 512;
// The ripple field's texel budget, and its least texels per css px.
const FIELD_TEXELS = 240000;
const FIELD_SCALE = 0.75;
// Field tiles (texels) list the sources whose rings reach into them, two
// 32-bit words a tile, at most TILE_WORDS words.
const TILE_W = 32;
const TILE_H = 16;
const TILE_WORDS = 1024;
// The rings' uniform buffer: three vec4 a source, then the tile words.
const SOURCE_FLOATS = MAX_SOURCES * 12;
// Mist over the far water: a tile of it (texels), baked once, and how wide it
// lies across the panel (css px) and how fast it drifts (css px/s).
const MIST_TEXELS_W = 512;
const MIST_TEXELS_H = 64;
const MIST_TILE_W = 1100;
const MIST_DRIFT = 4;
// The lamp on the far bank: across the width, and css px above the horizon per px of height.
const LAMP_ACROSS = 0.735;
const LAMP_RISE = 0.034;

const SKY_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uSkySize;
uniform vec2 uCss;
uniform float uHorizon;
uniform vec2 uLamp;
${GLSL_NOISE}

// The far bank: a low line of trees, in css px above the horizon.
float bankHeight(float x) {
  float s = uCss.y / 430.0;
  float trees = fbm(vec2(x * 0.018 / s, 4.2));
  float hills = valueNoise(vec2(x * 0.0035 / s, 9.1));
  return s * (2.0 + 5.0 * hills + 7.0 * smoothstep(0.38, 0.78, trees));
}

void main() {
  vec2 px = vec2(gl_FragCoord.x / uSkySize.x * uCss.x, uHorizon * (1.0 - gl_FragCoord.y / uSkySize.y));
  float up = clamp((uHorizon - px.y) / max(uHorizon, 1.0), 0.0, 1.0);

  // Overcast night: near black overhead, a teal mist low down.
  vec3 zenith = vec3(0.04, 0.052, 0.064);
  vec3 haze = vec3(0.1, 0.165, 0.172);
  vec3 color = mix(haze, zenith, pow(up, 0.5));
  float cloud = fbm(vec2(px.x * 0.0032, px.y * 0.011 + 3.0));
  color *= 0.84 + 0.32 * cloud;

  // The lamp lights the rain mist around it.
  vec2 q = px - uLamp;
  float dist = length(q * vec2(1.0, 1.25)) / clamp(uCss.y / 430.0, 0.5, 1.0);
  vec3 lamp = vec3(1.0, 0.62, 0.27);
  color += lamp * (0.3 * exp(-dist / 9.0) + 0.1 * exp(-dist / 42.0) + 0.045 * exp(-dist / 170.0));

  // The bank, hazed by distance; the lamp's post stands on it.
  float top = uHorizon - bankHeight(px.x);
  float onBank = smoothstep(top - 0.7, top + 0.7, px.y);
  vec3 bank = mix(vec3(0.02, 0.03, 0.035), haze, 0.3);
  bank += lamp * 0.05 * exp(-dist / 30.0);
  float post = (1.0 - smoothstep(0.35, 0.9, abs(q.x))) * step(uLamp.y + 1.5, px.y);
  color = mix(color, bank, max(onBank, post * 0.9));

  // The flame itself.
  color += vec3(1.0, 0.86, 0.62) * (1.0 - smoothstep(0.6, 2.0, length(q)));
  outColor = vec4(color, 1.0);
}
`;

// A tile of mist whose noise wraps both ways, so it can drift without a seam.
const MIST_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uSize;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float wrapNoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec2 lo = mod(i, period);
  vec2 hi = mod(i + 1.0, period);
  float a = hash12(lo);
  float b = hash12(vec2(hi.x, lo.y));
  float c = hash12(vec2(lo.x, hi.y));
  float d = hash12(hi);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  // Long, low banks: few cells across the tile, fewer still up it.
  vec2 period = vec2(7.0, 2.0);
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * wrapNoise(uv * period + float(i) * 3.7, period);
    period *= 2.0;
    amp *= 0.5;
  }
  outColor = vec4(vec3(sum / 0.9375), 1.0);
}
`;

const FIELD_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uFieldSize;
uniform float uWidth;
uniform float uCenterX;
uniform float uBand;
uniform float uFocal;
// Per source: pond x, pond z, age (s), slope; first and last drip (s after
// landing), drip period, warmth; 1 / ring speed, outer and inner ring
// radius, wavenumber. Then which sources each tile lists.
layout(std140) uniform Rings {
  vec4 uSources[${MAX_SOURCES * 3}];
  uvec4 uTileWords[${TILE_WORDS / 4}];
};
uniform ivec3 uTiling;  // tile width, height (texels), tiles across
uniform float uOmega;
uniform float uPacket;
uniform float uSpan;
uniform float uLife;
uniform float uDrip;
uniform float uSettle;
uniform float uSettled;
uniform float uSwellTime;

// One wave packet of a ring: slope along the ring (x) and crest height (y).
vec2 packetAt(float u) {
  float envelope = exp(-u * u * uPacket);
  float phase = uOmega * u;
  return envelope * vec2(cos(phase), sin(phase));
}

// A few long, slow, shallow waves: the pond is never quite a mirror.
vec2 swellWave(vec2 p, vec2 dir, float number, float speed, float slope, vec2 foot) {
  float along = number * length(dir * foot);
  float keep = exp(-0.125 * along * along);
  return dir * (slope * keep * cos(number * (p.x * dir.x + p.y * dir.y) - speed * uSwellTime));
}

void main() {
  float d = max(uBand * (1.0 - gl_FragCoord.y / uFieldSize.y), 0.25);
  float cssX = gl_FragCoord.x / uFieldSize.x * uWidth;
  vec2 pond = vec2((cssX - uCenterX) / d, uFocal / d);
  float texel = uWidth / uFieldSize.x;
  // One texel's size on the pond, across and in depth.
  vec2 foot = vec2(texel / d, texel * pond.y / d);

  vec2 slope = swellWave(pond, vec2(0.8, 0.6), 2.3, 0.45, 0.008, foot);
  slope += swellWave(pond, vec2(-0.87, 0.5), 3.9, 0.6, 0.007, foot);
  slope += swellWave(pond, vec2(0.96, -0.28), 6.1, 0.75, 0.005, foot);
  float crest = 0.0;
  float warm = 0.0;

  // Only the sources this tile lists: one bit each, 32 to a word.
  ivec2 tile = ivec2(gl_FragCoord.xy) / uTiling.xy;
  int words = (tile.y * uTiling.z + tile.x) * 2;
  for (int word = 0; word < 2; word++) {
    int at = words + word;
    uint bits = uTileWords[at >> 2][at & 3];
    while (bits != 0u) {
      uint lowest = bits & (~bits + 1u);
      bits ^= lowest;
      int i = word * 32 + int(log2(float(lowest)) + 0.5);
      vec4 a = uSources[i * 3];
      vec4 c = uSources[i * 3 + 2];
      vec2 delta = pond - a.xy;
      if (max(abs(delta.x), abs(delta.y)) > c.y) continue;
      float r2 = dot(delta, delta);
      if (r2 > c.y * c.y || r2 < c.z * c.z) continue;
      vec4 b = uSources[i * 3 + 1];
      float r = sqrt(r2);
      // How long the wave here has been spreading, and when it left the source.
      float travel = r * c.x;
      float emitted = a.z - travel;
      float fade = a.w * exp(-travel * uLife);

      // The landing ring, then the drips: the one or two packets nearest.
      vec2 wave = packetAt(emitted) * step(b.x, 0.0);
      if (b.y > 0.0) {
        float period = b.z;
        float first = max(ceil(b.x / period - 0.01), 1.0);
        float last = floor(b.y / period + 0.01);
        float k = clamp(floor(emitted / period + 0.5), first, last);
        float u = emitted - k * period;
        float other = clamp(k + (u > 0.0 ? 1.0 : -1.0), first, last);
        float settle = uDrip * mix(uSettled, 1.0, exp(-max(emitted, 0.0) / uSettle));
        if (first <= last) {
          vec2 drips = packetAt(u);
          if (other != k) drips += packetAt(emitted - other * period);
          wave += drips * settle;
        }
      }

      vec2 dir = delta / max(r, 1e-5);
      float along = c.w * length(dir * foot);
      float w = fade * exp(-0.125 * along * along);
      slope -= dir * (w * wave.x);
      crest += w * wave.y;
      warm += b.w * w * max(wave.y, 0.0);
    }
  }
  // Offset and scaled into 0..1, so an RGBA8 field (no half floats) still works.
  outColor = vec4(clamp(slope * 0.25 + 0.5, 0.0, 1.0), clamp(warm * 3.0, 0.0, 1.0), clamp(crest * 0.25 + 0.5, 0.0, 1.0));
}
`;

const SCENE_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uCss;
uniform float uHorizon;
uniform float uFocal;
uniform float uCenterX;
uniform vec2 uLamp;
uniform sampler2D uSky;
uniform sampler2D uField;
uniform sampler2D uMist;
uniform float uTime;
uniform float uDrizzle;
uniform float uMistDrift;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 skyAt(vec2 p) {
  return texture(uSky, vec2(p.x / uCss.x, 1.0 - p.y / uHorizon)).rgb;
}

// Soft banks of mist lying on the far water and just above it.
float mistAt(vec2 px) {
  float h = px.y - uHorizon;
  float band = h < 0.0 ? uCss.y * 0.07 : uCss.y * 0.16;
  float lie = exp(-h * h / (band * band));
  if (lie < 0.02) return 0.0;
  vec2 uv = vec2(px.x / ${MIST_TILE_W}.0 + uMistDrift, (h + uCss.y * 0.07) / (uCss.y * 0.2));
  return lie * smoothstep(0.32, 0.8, texture(uMist, uv).r);
}

// Fine rain seen only where the lamp lights it.
float drizzle(vec2 px) {
  vec2 q = (px - uLamp) * vec2(1.0, 0.55);
  float light = exp(-length(q) / (50.0 * clamp(uCss.y / 430.0, 0.5, 1.0)));
  if (light < 0.03) return 0.0;
  float sum = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float near = float(1 - layer);
    float cell = mix(3.0, 5.0, near);
    float column = floor(px.x / cell);
    float seed = hash11(column + 37.0 * float(layer));
    float period = mix(70.0, 120.0, seed);
    float fall = mix(300.0, 520.0, near) * (0.85 + 0.3 * seed);
    float y = mod(px.y - uTime * fall + seed * 311.0, period);
    float len = mix(9.0, 17.0, near);
    float streak = step(period - len, y) * (y - period + len) / len;
    float across = abs(fract(px.x / cell) - 0.5) * cell;
    sum += streak * (1.0 - smoothstep(0.25, 0.75, across)) * mix(0.55, 1.0, near);
  }
  return sum * light;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 color;
  if (px.y < uHorizon) {
    color = skyAt(px);
  } else {
    float d = px.y - uHorizon;
    float band = uCss.y - uHorizon;
    vec4 field = texture(uField, vec2(px.x / uCss.x, 1.0 - d / band));
    vec2 slope = field.xy * 4.0 - 2.0;
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 view = normalize(vec3((px.x - uCenterX) / uFocal, -d / uFocal, 1.0));
    vec3 ray = reflect(view, normal);
    float rise = max(ray.y, 0.0) / max(ray.z, 0.05);
    float across = ray.x / max(ray.z, 0.05);
    vec3 sky = skyAt(vec2(uCenterX + uFocal * across, uHorizon - uFocal * rise));
    float facing = clamp(-dot(view, normal), 0.0, 1.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
    vec3 deep = vec3(0.016, 0.046, 0.056);
    color = mix(deep, sky * 1.5, fresnel);

    // The lamp's path: its light smeared down the water by ripples too fine to see.
    vec2 lampDir = vec2(uLamp.x - uCenterX, uHorizon - uLamp.y) / uFocal;
    float off = across - lampDir.x;
    float below = rise - lampDir.y;
    float width = 0.006 + 0.02 * max(below, 0.0);
    float path = exp(-off * off / (width * width)) * exp(-abs(below) / 0.11);
    color += vec3(1.0, 0.6, 0.24) * path * (0.12 + 0.9 * fresnel);

    // Ring crests catch the light and troughs hold the dark; a sounding
    // note's rings run warm.
    float crest = field.w * 4.0 - 2.0;
    color *= 1.0 - 0.35 * smoothstep(0.0, 0.2, -crest);
    color += vec3(0.36, 0.55, 0.52) * smoothstep(0.0, 0.22, crest) * 0.38;
    color += vec3(1.0, 0.64, 0.24) * field.z * 0.55;

    // The far water fades into the haze at the waterline.
    color = mix(color, vec3(0.085, 0.135, 0.142), exp(-d / 10.0) * 0.55);
  }
  color = mix(color, vec3(0.13, 0.18, 0.185), mistAt(px) * 0.5);
  color += vec3(0.62, 0.52, 0.4) * drizzle(px) * uDrizzle * 0.18;
  outColor = vec4(color, 1.0);
}
`;

const STREAK_VERTEX = `#version 300 es
precision highp float;
in vec4 aDrop;  // x, head y, landing y, blur length (css px)
in vec3 aLook;  // half width (css px), brightness, depth 0 (far) .. 1 (near)
uniform vec2 uCss;
out vec2 vPixel;
flat out vec4 vShape;  // x, head y, tail y, half width
flat out vec2 vTone;   // brightness, reflection (0 the drop, 1 its reflection)
const int CORNER[6] = int[6](0, 1, 2, 2, 1, 3);

void main() {
  int quad = gl_VertexID / 6;
  int corner = CORNER[gl_VertexID - quad * 6];
  vec2 c = vec2(corner & 1, corner >> 1);
  float head = aDrop.y;
  float tail = head - aDrop.w;
  float halfWidth = aLook.x;
  float brightness = aLook.y;
  if (quad == 1) {
    // Its reflection rises to meet it.
    head = 2.0 * aDrop.z - head;
    tail = head + aDrop.w;
    brightness *= mix(0.7, 0.35, aLook.z);
  }
  float pad = halfWidth + 1.5;
  vec2 pixel = vec2(
    aDrop.x + (c.x * 2.0 - 1.0) * pad,
    mix(min(head, tail) - pad, max(head, tail) + pad, c.y)
  );
  vPixel = pixel;
  vShape = vec4(aDrop.x, head, tail, halfWidth);
  vTone = vec2(brightness, float(quad));
  gl_Position = vec4(pixel.x / uCss.x * 2.0 - 1.0, 1.0 - pixel.y / uCss.y * 2.0, 0.0, 1.0);
}
`;

const STREAK_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vPixel;
flat in vec4 vShape;
flat in vec2 vTone;
out vec4 outColor;
uniform float uDpr;
uniform vec2 uLamp;
uniform float uLampReach;

void main() {
  float lo = min(vShape.y, vShape.z);
  float hi = max(vShape.y, vShape.z);
  // Thinner than a device pixel draws a pixel wide and dimmer.
  float halfWidth = max(vShape.w, 0.6 / uDpr);
  vec2 q = vec2(vPixel.x - vShape.x, vPixel.y - clamp(vPixel.y, lo, hi));
  float dist = length(q) - halfWidth;
  float aa = 0.8 / uDpr;
  float cover = 1.0 - smoothstep(-aa, aa, dist);
  // A bright bead at the drop, its blur fading back along the streak.
  float t = clamp(abs(vPixel.y - vShape.y) / max(hi - lo, 1.0), 0.0, 1.0);
  float bead = exp(-dot(vPixel - vec2(vShape.x, vShape.y), vPixel - vec2(vShape.x, vShape.y)) / (halfWidth * halfWidth * 2.5));
  float lum = (cover * 0.8 * pow(1.0 - t, 2.2) + bead * 0.7) * vTone.x * (vShape.w / halfWidth);
  vec3 cool = mix(vec3(0.7, 0.82, 0.8), vec3(0.45, 0.62, 0.64), vTone.y);
  // Drops falling past the lamp catch its light.
  float lamp = exp(-length((vPixel - uLamp) * vec2(1.0, 0.6)) / uLampReach);
  vec3 color = mix(cool, vec3(1.0, 0.8, 0.5), 0.55 * lamp * (1.0 - vTone.y));
  outColor = vec4(color * lum, 1.0);
}
`;

const SPRITE_VERTEX = `#version 300 es
precision highp float;
in vec4 aSpot;  // x, y (css px), seconds since it landed, radius across (css px)
in vec4 aKind;  // 0 splash or 1 source light, strength, how fresh a light is (1 .. settled), seed
uniform vec2 uCss;
uniform float uHorizon;
uniform float uFocal;
out vec2 vLocal;
flat out vec4 vSpot;  // radius across, squash, age, seed
flat out vec4 vKind;
void main() {
  vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  float squash = clamp((aSpot.y - uHorizon) / uFocal, 0.06, 1.0);
  float radius = aSpot.w;
  // Room above for a splash's crown, a margin all round.
  vec2 lo = vec2(-radius - 3.0, -radius * (aKind.x < 0.5 ? 1.6 : squash) - 3.0);
  vec2 hi = vec2(radius + 3.0, radius * squash + 3.0);
  vec2 local = mix(lo, hi, c);
  vLocal = local;
  vSpot = vec4(radius, squash, aSpot.z, aKind.w);
  vKind = aKind;
  vec2 pixel = aSpot.xy + local;
  gl_Position = vec4(pixel.x / uCss.x * 2.0 - 1.0, 1.0 - pixel.y / uCss.y * 2.0, 0.0, 1.0);
}
`;

const SPRITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec4 vSpot;
flat in vec4 vKind;
out vec4 outColor;
uniform float uDpr;

void main() {
  float radius = vSpot.x;
  float squash = vSpot.y;
  float age = vSpot.z;
  vec2 level = vec2(vLocal.x, vLocal.y / squash);
  vec3 color;
  if (vKind.x < 0.5) {
    // A splash: a quick flash where it lands and a crown of droplets.
    float spread = radius * (0.25 + 1.6 * age);
    float flash = exp(-age / 0.07) * exp(-dot(level, level) / (spread * spread));
    float crown = 0.0;
    for (int j = 0; j < 5; j++) {
      float angle = 6.2831853 * (vSpot.w + float(j) * 0.2);
      float reach = radius * (0.35 + 1.1 * age / 0.4);
      vec2 drop = vec2(cos(angle) * reach, sin(angle) * reach * squash);
      drop.y -= radius * (3.2 * age - 7.0 * age * age) * (0.7 + 0.3 * sin(angle * 3.0));
      vec2 q = vLocal - drop;
      crown += exp(-dot(q, q) * uDpr * uDpr * 1.4);
    }
    crown *= smoothstep(0.4, 0.15, age) * 0.5;
    color = vec3(0.78, 0.88, 0.84) * (flash * 0.9 + crown) * vKind.y;
  } else {
    // A sounding source: warm light on the water where its drops land, with
    // a bright core while the note is fresh.
    float r2 = dot(level, level) / (radius * radius);
    float fresh = clamp((vKind.z - ${SETTLED.toFixed(3)}) / ${(1 - SETTLED).toFixed(3)}, 0.0, 1.0);
    float light = exp(-r2 * 2.2) * 0.45 + exp(-r2 * 26.0) * 0.8 * fresh;
    light *= 1.0 + 1.2 * exp(-age / 0.09);
    color = vec3(1.0, 0.72, 0.36) * light * vKind.y;
  }
  outColor = vec4(color, 1.0);
}
`;

// Where on the water a note's drop lands: a depth from its seed.
const landingDepth = (seed) => LAND_FAR + (LAND_NEAR - LAND_FAR) * seed;
// A note's drip period, a little different for each so held chords drift apart.
const dripPeriod = (seed) => DRIP_SECONDS * (0.85 + 0.3 * ((seed * 7.31) % 1));
// Seconds after its landing of a note's last drip (0: it never drips).
const lastDripOf = (duration, period) => Math.max(0, Math.ceil(duration / period - 1e-6) - 1) * period;
// Soft notes still make visible rings.
const strengthOf = (velocity) => 0.35 + 0.65 * Math.sqrt(velocity);

function createRain(gl) {
  const emptyVao = createEmptyVao(gl);
  const skyProgram = createProgram(gl, FULLSCREEN_VERTEX, SKY_FRAGMENT, [
    'uSkySize', 'uCss', 'uHorizon', 'uLamp'
  ]);
  const fieldProgram = createProgram(gl, FULLSCREEN_VERTEX, FIELD_FRAGMENT, [
    'uFieldSize', 'uWidth', 'uCenterX', 'uBand', 'uFocal', 'uTiling', 'uOmega', 'uPacket', 'uSpan',
    'uLife', 'uDrip', 'uSettle', 'uSettled', 'uSwellTime'
  ]);
  const sceneProgram = createProgram(gl, FULLSCREEN_VERTEX, SCENE_FRAGMENT, [
    'uRes', 'uDpr', 'uCss', 'uHorizon', 'uFocal', 'uCenterX', 'uLamp', 'uSky', 'uField', 'uMist',
    'uTime', 'uDrizzle', 'uMistDrift'
  ]);
  const streakProgram = createProgram(gl, STREAK_VERTEX, STREAK_FRAGMENT, [
    'uCss', 'uDpr', 'uLamp', 'uLampReach'
  ]);
  const spriteProgram = createProgram(gl, SPRITE_VERTEX, SPRITE_FRAGMENT, [
    'uCss', 'uHorizon', 'uFocal', 'uDpr'
  ]);
  const sky = createTarget(gl);
  const field = createTarget(gl, { hdr: true });
  // The mist tile never changes: bake it now, repeating both ways.
  const mist = createTarget(gl);
  mist.resize(MIST_TEXELS_W, MIST_TEXELS_H);
  gl.bindTexture(gl.TEXTURE_2D, mist.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const mistProgram = createProgram(gl, FULLSCREEN_VERTEX, MIST_FRAGMENT, ['uSize']);
  mist.bind();
  gl.useProgram(mistProgram.program);
  gl.uniform2f(mistProgram.uniforms.uSize, MIST_TEXELS_W, MIST_TEXELS_H);
  gl.bindVertexArray(emptyVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteProgram(mistProgram.program);
  let tileW = TILE_W;
  let tilesX = 1;
  let tilesY = 1;
  const streaks = createInstances(gl, streakProgram.program, [['aDrop', 4], ['aLook', 3]], MAX_STREAKS);
  const sprites = createInstances(gl, spriteProgram.program, [['aSpot', 4], ['aKind', 4]], MAX_SPRITES);

  // Ring sources: a note's landing and its drips, on the ring clock.
  const sourceNote = new Int32Array(MAX_SOURCES);
  const sourceSpawn = new Float64Array(MAX_SOURCES);
  const sourceFirst = new Float64Array(MAX_SOURCES);
  const sourceLast = new Float64Array(MAX_SOURCES);
  let sourceCount = 0;
  // The rings' uniform buffer, written through two views of one block.
  const ringWords = new Uint32Array(SOURCE_FLOATS + TILE_WORDS);
  const packed = new Float32Array(ringWords.buffer, 0, SOURCE_FLOATS);
  const tileBits = new Uint32Array(ringWords.buffer, SOURCE_FLOATS * 4, TILE_WORDS);
  const ringBuffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, ringBuffer);
  gl.bufferData(gl.UNIFORM_BUFFER, ringWords.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  gl.uniformBlockBinding(fieldProgram.program, gl.getUniformBlockIndex(fieldProgram.program, 'Rings'), 0);
  // Nothing to send while the pond has been still for a frame already.
  let ringsSent = false;
  const range = { start: 0, end: 0 };
  const geo = {
    ready: false,
    width: 1,
    horizon: 1,
    band: 1,
    focal: 1,
    centerX: 0,
    lampX: 0,
    lampY: 0,
    ringScale: 1,
    spotScale: 1
  };
  // The ring clock runs with the song, and on through pauses so rings settle.
  // Kept in a typed array: numbers that change every frame stay unboxed.
  const clocks = new Float64Array(3);
  const PAUSED = 0;
  const LAST_SONG_TIME = 1;
  const RING_CLOCK = 2;
  let wasPlaying = false;
  let notes = null;

  const removeSource = (slot) => {
    sourceCount -= 1;
    sourceNote[slot] = sourceNote[sourceCount];
    sourceSpawn[slot] = sourceSpawn[sourceCount];
    sourceFirst[slot] = sourceFirst[sourceCount];
    sourceLast[slot] = sourceLast[sourceCount];
  };

  const addSource = (noteIndex, spawn, first, last) => {
    let slot = sourceCount;
    if (slot < MAX_SOURCES) {
      sourceCount += 1;
    } else {
      // Full: the source whose last ring left longest ago gives way.
      slot = 0;
      for (let i = 1; i < MAX_SOURCES; i += 1) {
        if (sourceSpawn[i] + sourceLast[i] < sourceSpawn[slot] + sourceLast[slot]) slot = i;
      }
    }
    sourceNote[slot] = noteIndex;
    sourceSpawn[slot] = spawn;
    sourceFirst[slot] = first;
    sourceLast[slot] = last;
  };

  // Notes already sounding (after a seek or a resume) drip from their next
  // drop on; those starting after `startedBy` are this frame's onsets instead.
  const addHeldSources = (frame, clock, startedBy) => {
    const { songTime } = frame;
    visibleRange(frame, 0, 0, range);
    for (let index = range.start; index < range.end; index += 1) {
      const note = notes[index];
      if (note.time > startedBy || note.end <= songTime) continue;
      const period = dripPeriod(note.seed);
      const since = songTime - note.time;
      const next = (Math.floor(since / period) + 1) * period;
      const last = lastDripOf(note.duration, period);
      if (next <= last + 1e-6) addSource(index, clock - since, next, last);
    }
  };

  const updateSources = (frame) => {
    const { songTime, playing } = frame;
    if (!playing) clocks[PAUSED] += frame.dt;
    const clock = songTime + clocks[PAUSED];
    clocks[RING_CLOCK] = clock;
    notes = frame.notes;
    if (frame.jumped) {
      sourceCount = 0;
      if (playing) addHeldSources(frame, clock, songTime);
    } else if (playing && !wasPlaying) {
      addHeldSources(frame, clock, clocks[LAST_SONG_TIME]);
    } else if (!playing && wasPlaying) {
      // Paused: nothing more drips.
      for (let i = sourceCount - 1; i >= 0; i -= 1) {
        const age = clock - sourceSpawn[i];
        if (age < sourceFirst[i]) removeSource(i);
        else if (sourceLast[i] > age) sourceLast[i] = age;
      }
    }
    if (playing && !frame.jumped) {
      onsetRange(frame, clocks[LAST_SONG_TIME], songTime, range);
      for (let index = range.start; index < range.end; index += 1) {
        const note = notes[index];
        addSource(index, clock - (songTime - note.time), 0, lastDripOf(note.duration, dripPeriod(note.seed)));
      }
    }
    wasPlaying = playing;
    clocks[LAST_SONG_TIME] = songTime;
    for (let i = sourceCount - 1; i >= 0; i -= 1) {
      if (clock - sourceSpawn[i] - sourceLast[i] > RING_REACH * geo.ringScale + PACKET_SPAN) removeSource(i);
    }
  };

  // Lists source `slot` in every field tile its rings can reach: the box round
  // the disc of their outer radius, seen in perspective. It reads the packed
  // source, so no numbers are passed (and boxed) per call.
  const markTiles = (slot) => {
    const o = slot * 12;
    const x = packed[o];
    const z = packed[o + 1];
    const outer = packed[o + 9];
    if (outer <= 0) return;
    const { band, focal, centerX } = geo;
    const nearDepth = focal / Math.max(z - outer, focal / band);
    const farDepth = focal / (z + outer);
    const left = centerX + Math.min((x - outer) * nearDepth, (x - outer) * farDepth);
    const right = centerX + Math.max((x + outer) * nearDepth, (x + outer) * farDepth);
    const across = field.width / geo.width;
    const tx0 = Math.max(0, Math.floor((left * across - 1) / tileW));
    const tx1 = Math.min(tilesX - 1, Math.floor((right * across + 1) / tileW));
    // Field rows count up from the near edge.
    const ty0 = Math.max(0, Math.floor(((1 - nearDepth / band) * field.height - 1) / TILE_H));
    const ty1 = Math.min(tilesY - 1, Math.floor(((1 - farDepth / band) * field.height + 1) / TILE_H));
    const word = slot >> 5;
    const bit = 1 << (slot & 31);
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        const t = (ty * tilesX + tx) * 2 + word;
        tileBits[t] |= bit;
      }
    }
  };

  const packSources = (frame) => {
    const { width, songTime } = frame;
    const clock = clocks[RING_CLOCK];
    const { band, focal, centerX } = geo;
    const reach = RING_REACH * geo.ringScale;
    tileBits.fill(0, 0, tilesX * tilesY * 2);
    for (let i = 0; i < sourceCount; i += 1) {
      const note = notes[sourceNote[i]];
      const landing = landingDepth(note.seed);
      const depth = band * landing;
      const age = clock - sourceSpawn[i];
      // Far drops ring wider than true scale, so they still read from here.
      const speed = RING_SPEED * Math.sqrt(LAND_NEAR / landing);
      const o = i * 12;
      packed[o] = (pitchX(frame, note.midi) * width - centerX) / depth;
      packed[o + 1] = focal / depth;
      packed[o + 2] = age;
      packed[o + 3] = RING_SLOPE * strengthOf(note.velocity);
      packed[o + 4] = sourceFirst[i];
      packed[o + 5] = sourceLast[i];
      packed[o + 6] = dripPeriod(note.seed);
      const held = Math.max(0, Math.min(songTime - note.time, note.duration));
      packed[o + 7] = (SETTLED + (1 - SETTLED) * Math.exp(-held / SETTLE_SECONDS))
        * (songTime < note.end ? 1 : Math.exp(-(songTime - note.end) / RELEASE_SECONDS));
      // The rings so far span from the newest packet out to the oldest, and no
      // further than they live.
      packed[o + 8] = 1 / speed;
      packed[o + 9] = speed * Math.max(0, Math.min(reach, age - sourceFirst[i] + PACKET_SPAN));
      packed[o + 10] = speed * Math.max(0, age - sourceLast[i] - PACKET_SPAN);
      packed[o + 11] = RING_OMEGA / speed;
      markTiles(i);
    }
  };

  // The drops in the air, their splashes and the sounding sources: all from the score.
  let streakCount = 0;
  let spriteCount = 0;

  // A drop `left` of the way (1 .. 0) along its fall to landY (css px); nearer
  // drops are wider, and every streak as long as its drop moves in an exposure.
  const pushStreak = (x, landY, left, size, depth) => {
    if (streakCount >= MAX_STREAKS) return;
    const o = streakCount * streaks.stride;
    const data = streaks.data;
    const travel = landY - FALL_FROM;
    data[o] = x;
    data[o + 1] = landY - travel * left;
    data[o + 2] = landY;
    data[o + 3] = Math.min(70, Math.max(3, travel / FALL_SECONDS * EXPOSURE)) * (0.55 + 0.45 * size);
    data[o + 4] = (0.45 + 0.6 * depth) * (0.7 + 0.3 * size);
    data[o + 5] = 0.5 + 0.5 * size;
    data[o + 6] = depth;
    streakCount += 1;
  };

  const pushSprite = (x, y, age, radius, kind, strength, fresh, seed) => {
    if (spriteCount >= MAX_SPRITES) return;
    const o = spriteCount * sprites.stride;
    const data = sprites.data;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = age;
    data[o + 3] = radius;
    data[o + 4] = kind;
    data[o + 5] = strength;
    data[o + 6] = fresh;
    data[o + 7] = seed;
    spriteCount += 1;
  };

  const packDrops = (frame) => {
    const { width, songTime } = frame;
    const { horizon, band } = geo;
    streakCount = 0;
    spriteCount = 0;
    visibleRange(frame, SPLASH_SECONDS + RELEASE_SECONDS, FALL_SECONDS, range);
    for (let index = range.start; index < range.end; index += 1) {
      const note = notes[index];
      const until = note.time - songTime;
      const after = songTime - note.end;
      if (after > RELEASE_SECONDS && until < -SPLASH_SECONDS) continue;
      const x = pitchX(frame, note.midi) * width;
      const depth = landingDepth(note.seed);
      const landY = horizon + band * depth;
      const strength = strengthOf(note.velocity);
      const spot = Math.sqrt(depth / LAND_NEAR) * geo.spotScale;

      if (until > 0) {
        pushStreak(x, landY, until / FALL_SECONDS, strength, depth);
      } else if (until > -SPLASH_SECONDS) {
        pushSprite(x, landY, -until, 7 * spot, 0, strength, 1, note.seed);
      }

      // A sounding source: its light, which brightens as each drip lands
      // (the drips themselves show as rings, as they do on a real pond).
      if (until <= 0 && after < RELEASE_SECONDS) {
        const period = dripPeriod(note.seed);
        const kLast = Math.round(lastDripOf(note.duration, period) / period);
        const sounding = after < 0;
        const settled = SETTLED + (1 - SETTLED) * Math.exp(-(sounding ? -until : note.duration) / SETTLE_SECONDS);
        const light = settled ** 1.8 * (sounding ? 1 : Math.exp(-after / (RELEASE_SECONDS * 0.4)));
        // Brighter for a moment each time a drop lands in it.
        const landed = Math.min(Math.floor(-until / period), kLast);
        pushSprite(x, landY, -until - landed * period, 11 * spot, 1, light * strength, settled, note.seed);
      }
    }
    streaks.upload(streakCount);
    sprites.upload(spriteCount);
  };

  const render = (frame) => {
    bindCanvas(gl, frame);
    if (!geo.ready) {
      gl.clearColor(0.034, 0.043, 0.052, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    updateSources(frame);
    packSources(frame);
    packDrops(frame);
    const ambient = frame.reducedMotion ? 0 : frame.time;

    // The ripple field, below the horizon only.
    field.bind();
    gl.disable(gl.BLEND);
    gl.useProgram(fieldProgram.program);
    if (sourceCount > 0 || ringsSent) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, ringBuffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, ringWords, 0, SOURCE_FLOATS + tilesX * tilesY * 2);
      ringsSent = sourceCount > 0;
    }
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ringBuffer);
    gl.uniform1f(fieldProgram.uniforms.uSwellTime, ambient);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, null);

    // The sky and the water.
    bindCanvas(gl, frame);
    gl.useProgram(sceneProgram.program);
    gl.uniform1f(sceneProgram.uniforms.uTime, ambient);
    gl.uniform1f(sceneProgram.uniforms.uDrizzle, frame.reducedMotion ? 0 : 1);
    gl.uniform1f(sceneProgram.uniforms.uMistDrift, (ambient * MIST_DRIFT / MIST_TILE_W) % 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sky.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, field.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mist.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Light on top: splashes and sources, then the drops.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (spriteCount > 0) {
      gl.useProgram(spriteProgram.program);
      sprites.draw(spriteCount);
    }
    if (streakCount > 0) {
      gl.useProgram(streakProgram.program);
      gl.bindVertexArray(streaks.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, streakCount);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  // The geometry, the baked sky and the field's size follow the canvas.
  const resize = (frame) => {
    const { width, height, dpr } = frame;
    geo.ready = width >= 8 && height >= 8;
    if (!geo.ready) return;
    const skyRows = Math.max(1, Math.round(height * HORIZON * dpr));
    geo.horizon = skyRows / dpr;
    geo.band = Math.max(1, height - geo.horizon);
    geo.focal = geo.band / NEAR_SQUASH;
    geo.centerX = width * 0.5;
    geo.lampX = Math.round(width * LAMP_ACROSS) + 0.5;
    geo.lampY = geo.horizon - height * LAMP_RISE;
    // Narrow panels let rings fade sooner, so they spread over about as many
    // pitches; splashes and lights shrink with the panel.
    geo.ringScale = Math.min(1, Math.max(0.55, width / (3.2 * height)));
    geo.spotScale = Math.min(1, Math.max(0.55, height / 430));
    // Small panels get a finer field: the same texel budget at most, never past the device's pixels.
    const fieldScale = Math.min(dpr, Math.max(FIELD_SCALE, Math.sqrt(FIELD_TEXELS / (width * geo.band))));
    field.resize(width * fieldScale, geo.band * fieldScale);
    geo.width = width;
    // Wider tiles when the field would need more words than the buffer holds.
    tileW = TILE_W;
    tilesY = Math.ceil(field.height / TILE_H);
    tilesX = Math.ceil(field.width / tileW);
    while (tilesX * tilesY * 2 > TILE_WORDS) {
      tileW *= 2;
      tilesX = Math.ceil(field.width / tileW);
    }
    // The tile layout changed: send the rings afresh next frame.
    tileBits.fill(0);
    ringsSent = true;
    // The field's fixed uniforms.
    const fu = fieldProgram.uniforms;
    gl.useProgram(fieldProgram.program);
    gl.uniform2f(fu.uFieldSize, field.width, field.height);
    gl.uniform1f(fu.uWidth, width);
    gl.uniform1f(fu.uCenterX, geo.centerX);
    gl.uniform1f(fu.uBand, geo.band);
    gl.uniform1f(fu.uFocal, geo.focal);
    gl.uniform3i(fu.uTiling, tileW, TILE_H, tilesX);
    gl.uniform1f(fu.uOmega, RING_OMEGA);
    gl.uniform1f(fu.uPacket, 1 / (PACKET_SECONDS * PACKET_SECONDS));
    gl.uniform1f(fu.uSpan, PACKET_SPAN);
    gl.uniform1f(fu.uLife, 1 / (RING_LIFE * geo.ringScale));
    gl.uniform1f(fu.uDrip, DRIP_SHARE);
    gl.uniform1f(fu.uSettle, SETTLE_SECONDS);
    gl.uniform1f(fu.uSettled, SETTLED);
    const su = sceneProgram.uniforms;
    gl.useProgram(sceneProgram.program);
    gl.uniform2f(su.uRes, frame.pixelWidth, frame.pixelHeight);
    gl.uniform1f(su.uDpr, dpr);
    gl.uniform2f(su.uCss, width, height);
    gl.uniform1f(su.uHorizon, geo.horizon);
    gl.uniform1f(su.uFocal, geo.focal);
    gl.uniform1f(su.uCenterX, geo.centerX);
    gl.uniform2f(su.uLamp, geo.lampX, geo.lampY);
    gl.uniform1i(su.uSky, 0);
    gl.uniform1i(su.uField, 1);
    gl.uniform1i(su.uMist, 2);
    gl.useProgram(spriteProgram.program);
    gl.uniform2f(spriteProgram.uniforms.uCss, width, height);
    gl.uniform1f(spriteProgram.uniforms.uHorizon, geo.horizon);
    gl.uniform1f(spriteProgram.uniforms.uFocal, geo.focal);
    gl.uniform1f(spriteProgram.uniforms.uDpr, dpr);
    gl.useProgram(streakProgram.program);
    gl.uniform2f(streakProgram.uniforms.uCss, width, height);
    gl.uniform1f(streakProgram.uniforms.uDpr, dpr);
    gl.uniform2f(streakProgram.uniforms.uLamp, geo.lampX, geo.lampY);
    gl.uniform1f(streakProgram.uniforms.uLampReach, 45 * geo.spotScale);

    // The sky, baked once per size.
    sky.resize(frame.pixelWidth, skyRows);
    sky.bind();
    gl.disable(gl.BLEND);
    gl.useProgram(skyProgram.program);
    gl.uniform2f(skyProgram.uniforms.uSkySize, sky.width, sky.height);
    gl.uniform2f(skyProgram.uniforms.uCss, width, height);
    gl.uniform1f(skyProgram.uniforms.uHorizon, geo.horizon);
    gl.uniform2f(skyProgram.uniforms.uLamp, geo.lampX, geo.lampY);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  return {
    resize,
    render,
    dispose() {
      streaks.dispose();
      sprites.dispose();
      sky.dispose();
      field.dispose();
      mist.dispose();
      gl.deleteBuffer(ringBuffer);
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(skyProgram.program);
      gl.deleteProgram(fieldProgram.program);
      gl.deleteProgram(sceneProgram.program);
      gl.deleteProgram(streakProgram.program);
      gl.deleteProgram(spriteProgram.program);
    }
  };
}

export default {
  id: 'rain',
  create: createRain
};
