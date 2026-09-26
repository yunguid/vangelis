/**
 * Lamp: Phosphor's highway without the monitor. The same lines, boxes and
 * names, lit like a warm filament in a dark room rather than a beam on glass:
 * no curvature, scanlines, grain or flicker, a gentler ramp from copper to
 * soft warm white, and moving lines that barely trail.
 */
import { createPhosphor } from './phosphor.js';

const LAMP_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uPersist;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform vec4 uLook;     // gain, bloom gain, front line (0..1 up), seconds
uniform vec2 uBloomTexel;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 beam = texture(uPersist, uv).rg;
  // A soft halo, much quieter than the tube's halation.
  vec2 bt = uBloomTexel;
  float halo = texture(uBloom, uv).r
    + texture(uBloom, uv + vec2(1.5, 0.5) * bt).r + texture(uBloom, uv + vec2(-0.5, 1.5) * bt).r
    + texture(uBloom, uv + vec2(-1.5, -0.5) * bt).r + texture(uBloom, uv + vec2(0.5, -1.5) * bt).r;
  float energy = (beam.r + beam.g * 0.5 + halo * 0.09 * uLook.y) * uLook.x;
  // Tungsten: copper where it is dim, warm white where it is bright, never
  // the tube's saturated amber.
  vec3 light = 1.0 - exp(-energy * vec3(1.0, 0.74, 0.46));

  // A warm, dark room, with the lamp's pool of light low and in the middle.
  vec3 room = vec3(0.052, 0.043, 0.036);
  vec2 pool = (uv - vec2(0.5, uLook.z)) * vec2(1.05, 2.4);
  room += vec3(0.05, 0.036, 0.024) * exp(-1.6 * dot(pool, pool));
  vec2 c = uv * 2.0 - 1.0;
  float vignette = 1.0 - 0.22 * pow(length(c * vec2(0.85, 1.0)), 2.5);
  outColor = vec4((room + light) * vignette, 1.0);
}
`;

export const LAMP = Object.freeze({
  composite: LAMP_COMPOSITE,
  fills: false,
  bloom: true,
  beamSigma: 0.55,
  tailSeconds: 0.07,
  flicker: false
});

export default {
  id: 'lamp',
  create: (gl) => createPhosphor(gl, LAMP)
};
