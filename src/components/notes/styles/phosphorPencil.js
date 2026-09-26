/**
 * Pencil: Phosphor's highway as a draughtsman's perspective drawing. The same
 * lines, boxes and names, drawn in graphite on warm drafting paper: the light
 * becomes how hard the pencil pressed, so the highway is faint construction
 * lines, the boxes firmer pencil, the front line a ruled stroke and the
 * distance lighter, and light strokes catch only the tops of the paper's
 * tooth. Where a note sounds its box takes a terracotta watercolour wash that
 * sits in the paper, darker at its wet edges and settling into the tooth. No
 * bloom, no halo, no streaks: a drawing.
 *
 * The paper (its tone, fibres, tooth, faint printed grid and the flow a wash
 * follows) is baked once per size into the look's material; a frame only
 * samples it.
 */
import { GLSL_NOISE } from '../glKit.js';
import { createPhosphor } from './phosphor.js';

// The sheet: r its tone (shaded towards the edges), g its tooth, b the
// printed grid, a the flow a wash follows (pigment gathers here, thins there).
const PAPER_MATERIAL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
out vec4 outColor;
${GLSL_NOISE}

// CSS px between the grid's fine lines; every fifth is printed a little firmer.
const float GRID = 18.0;

// Short fibres caught in the sheet, in about half the cells of 28 css px,
// most a shade paler than the paper and a few a shade darker.
float fibres(vec2 p) {
  vec2 cell = floor(p / 28.0);
  float mark = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 origin = (id + vec2(hash12(id), hash12(id + 17.0))) * 28.0;
      float angle = hash12(id + 31.0) * 6.2831853;
      vec2 dir = vec2(cos(angle), sin(angle));
      float reach = 3.0 + 6.0 * hash12(id + 47.0);
      vec2 q = p - origin;
      float along = clamp(q.x * dir.x + q.y * dir.y, -reach, reach);
      float across = length(q - dir * along);
      float tint = hash12(id + 5.0) > 0.75 ? -1.0 : 1.0;
      mark += tint * (1.0 - smoothstep(0.2, 0.8, across)) * step(0.5, hash12(id + 61.0));
    }
  }
  return mark;
}

void main() {
  vec2 px = gl_FragCoord.xy / uDpr;
  vec2 size = uRes / uDpr;
  vec2 uv = gl_FragCoord.xy / uRes;
  // Tooth: small rounded bumps with a finer grain in them.
  float tooth = 0.6 * valueNoise(px * 1.05) + 0.25 * valueNoise(px * 2.3 + 7.1)
    + 0.15 * hash12(gl_FragCoord.xy);
  tooth = clamp((tooth - 0.5) * 1.7 + 0.5, 0.0, 1.0);
  // The sheet's formation, faintly cloudy, lit a touch from the upper left.
  float cloud = valueNoise(px / 70.0) * 0.6 + valueNoise(px / 23.0 + 3.1) * 0.4;
  float tone = 0.97 + 0.02 * (cloud - 0.5) + 0.02 * (tooth - 0.5) + 0.014 * fibres(px);
  tone *= 1.0 + 0.02 * (uv.y - 0.5) - 0.025 * (uv.x - 0.5);
  // Shaded towards its edges and corners, so it sits in the dark page.
  vec2 c = uv * 2.0 - 1.0;
  tone *= (1.0 - 0.09 * pow(abs(c.x), 5.0)) * (1.0 - 0.08 * pow(abs(c.y), 4.0))
    * (1.0 - 0.04 * pow(length(c), 3.0));

  // The printed grid, square to the sheet from the middle of its foot.
  vec2 cell = (px - vec2(size.x * 0.5, 0.0)) / GRID;
  vec2 toMinor = abs(fract(cell + 0.5) - 0.5) * GRID;
  vec2 toMajor = abs(fract(cell / 5.0 + 0.5) - 0.5) * GRID * 5.0;
  float aa = 0.75 / uDpr;
  vec2 minor = 1.0 - smoothstep(vec2(0.28 - aa), vec2(0.28 + aa), toMinor);
  vec2 major = 1.0 - smoothstep(vec2(0.4 - aa), vec2(0.4 + aa), toMajor);
  float grid = max(0.4 * max(minor.x, minor.y), max(major.x, major.y)) * (0.8 + 0.2 * tooth);

  float flow = fbm(px / 16.0 + 11.0);
  outColor = vec4(tone, tooth, grid, flow);
}
`;

const PENCIL_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uPersist;
uniform sampler2D uMaterial;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uLook;     // gain, bloom gain, front line (0..1 up), seconds
out vec4 outColor;

// Warm drafting paper, a touch lighter and cleaner than the keys' cream.
const vec3 PAPER = vec3(0.975, 0.945, 0.875);
// The grid's pale blue-green ink.
const vec3 GRID_INK = vec3(0.5, 0.64, 0.64);
// Graphite where the pencil pressed hardest: a dark warm grey, never black.
const vec3 LEAD = vec3(0.24, 0.225, 0.215);
// What a terracotta wash absorbs per unit of pigment; where the pigment
// separates it leans a little rosier.
const vec3 PIGMENT = vec3(0.1, 0.62, 1.25);
const vec3 PIGMENT_ROSE = vec3(0.16, 0.76, 1.02);

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 light = texture(uPersist, uv) * uLook.x;
  vec4 sheet = texture(uMaterial, uv);
  // Paper warms as it darkens towards its edges.
  vec3 color = PAPER * pow(vec3(sheet.r), vec3(0.88, 1.0, 1.25));
  color = mix(color, GRID_INK, sheet.b * 0.05);
  float valley = 1.0 - sheet.g;

  // Watercolour where a note sounds, softened by a pixel so its edges never
  // stair-step (two bilinear taps between the texels either side): denser at
  // its wet edges, where the taps around it find less wash, and settled into
  // the tooth's valleys.
  vec2 texel = 0.5 / uRes;
  float wash = 0.5 * (texture(uPersist, uv + texel).b + texture(uPersist, uv - texel).b) * uLook.x;
  if (wash > 1e-3) {
    // Explicit level-0 reads: no derivatives needed inside the branch.
    vec2 r = vec2(2.0 * uDpr) / uRes;
    float ring = textureLod(uPersist, uv + vec2(r.x, 0.0), 0.0).b
      + textureLod(uPersist, uv - vec2(r.x, 0.0), 0.0).b
      + textureLod(uPersist, uv + vec2(0.0, r.y), 0.0).b
      + textureLod(uPersist, uv - vec2(0.0, r.y), 0.0).b
      + textureLod(uPersist, uv + r * 0.7, 0.0).b
      + textureLod(uPersist, uv - r * 0.7, 0.0).b
      + textureLod(uPersist, uv + vec2(r.x, -r.y) * 0.7, 0.0).b
      + textureLod(uPersist, uv + vec2(-r.x, r.y) * 0.7, 0.0).b;
    float wet = clamp(1.0 - ring * uLook.x / (8.0 * wash), 0.0, 1.0);
    float pigment = (1.0 - exp(-wash * 2.8)) * (0.75 + 0.5 * sheet.a);
    pigment *= (1.0 + wet * (0.5 + 1.4 * sheet.a)) * (1.0 + 0.4 * (valley - 0.5));
    // Where the pigment separates: the flow again, at another scale.
    float rose = smoothstep(0.35, 0.7, textureLod(uMaterial, uv * 0.61 + 0.37, 0.0).a);
    color *= exp(-mix(PIGMENT, PIGMENT_ROSE, rose) * pigment);
  }

  // Graphite: the light is how hard the pencil pressed, a little unevenly
  // along a stroke. Light strokes catch only the tops of the tooth; pressing
  // harder fills its valleys too. The front line is ruled firmer, and the
  // distance is drawn lighter, so lines crowding the far end never blacken.
  float fromFront = (gl_FragCoord.y - uLook.z * uRes.y) / uDpr;
  float ruled = 1.0 + 1.1 * exp(-fromFront * fromFront * 0.8);
  float far = smoothstep(0.3, 0.9, (uv.y - uLook.z) / max(1.0 - uLook.z, 1e-3));
  // The hand's pressure: the flow again, magnified to spans of about 60 css px.
  float hand = texture(uMaterial, uv * 0.27 + 0.13).a;
  float lines = max(light.r - light.b, 0.0) * ruled * (0.85 + 0.3 * hand);
  float press = 1.0 - exp(-pow(lines, 1.25) * 1.25);
  float cover = press * (1.0 - 0.75 * valley * (1.0 - press)) * (1.0 - 0.45 * far);
  color = mix(color, LEAD, cover);
  outColor = vec4(color, 1.0);
}
`;

export const PENCIL = Object.freeze({
  composite: PENCIL_COMPOSITE,
  material: PAPER_MATERIAL,
  fills: true,
  bloom: false,
  beamSigma: 0.58,
  // The tail is never read: a drawing does not streak.
  tailSeconds: 0.03,
  flicker: false
});

export default {
  id: 'pencil',
  create: (gl) => createPhosphor(gl, PENCIL)
};
