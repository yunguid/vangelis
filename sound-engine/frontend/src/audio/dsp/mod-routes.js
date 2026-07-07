// Modulation-matrix route compiler: sanitizes a modRoutes array into flat
// typed arrays for the hot loop, and maps legacy single-LFO params onto
// implicit LFO1 routes.

import { MAX_MOD_ROUTES, MOD_SRC, MOD_DST, clamp } from './constants.js';

export function compileModRoutes(routes, legacy) {
  const src = new Int8Array(MAX_MOD_ROUTES + 2);
  const dst = new Int8Array(MAX_MOD_ROUTES + 2);
  const depth = new Float32Array(MAX_MOD_ROUTES + 2);
  let count = 0;

  if (Array.isArray(routes)) {
    for (const route of routes) {
      if (count >= MAX_MOD_ROUTES) break;
      if (!route) continue;
      const s = Math.floor(route.src ?? -1);
      const d = Math.floor(route.dst ?? -1);
      const k = Number(route.depth);
      if (s < 0 || s > 6 || d < 0 || d > 4) continue;
      if (!Number.isFinite(k) || k === 0) continue;
      src[count] = s;
      dst[count] = d;
      depth[count] = clamp(k, -1, 1);
      count++;
    }
  }

  // Legacy single-LFO params map onto implicit LFO1 routes with the exact
  // scaling the old hardcoded targets used (pitch +/-2st, amp +/-1, cutoff
  // +/-4st), so existing presets/UI keep their sound.
  if (legacy && legacy.lfoDepth > 0 && legacy.lfoRate > 0) {
    if (legacy.lfoTarget === 1) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.PITCH;
      depth[count] = clamp(legacy.lfoDepth * 2 / 12, -1, 1);
      count++;
    } else if (legacy.lfoTarget === 2) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.AMP;
      depth[count] = clamp(legacy.lfoDepth, -1, 1);
      count++;
    } else if (legacy.lfoTarget === 3) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.CUTOFF;
      depth[count] = clamp(legacy.lfoDepth * (4 / 12) / 4, -1, 1);
      count++;
    }
  }

  // Which sources does the hot loop actually need to evaluate?
  let usesLfo1 = false;
  let usesLfo2 = false;
  let usesModEnv = false;
  for (let i = 0; i < count; i++) {
    if (src[i] === MOD_SRC.LFO1) usesLfo1 = true;
    else if (src[i] === MOD_SRC.LFO2) usesLfo2 = true;
    else if (src[i] === MOD_SRC.MOD_ENV) usesModEnv = true;
  }

  return {
    src,
    dst,
    depth,
    // Smoothed per-route depth (~20ms) to avoid zipper clicks while dragging
    // depth controls; seeded by the caller.
    depthSmoothed: new Float32Array(depth),
    count,
    usesLfo1,
    usesLfo2,
    usesModEnv
  };
}
