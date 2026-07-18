/**
 * Physics & numerical-analysis kernels shared by the visualizers.
 *
 * - VerletChain: a damped elastic string (discrete 1-D wave equation with a
 *   restoring spring toward per-node targets) integrated with position
 *   Verlet. Used by WaveCandy's spectrum so the curve has real inertia:
 *   transients pluck it, tension carries travelling ripples, damping settles.
 * - Barycentric Lagrange interpolation on Chebyshev nodes: numerically
 *   stable polynomial interpolation (no Runge blow-up at the edges), used to
 *   distil the raw FFT into a silky spectral envelope.
 * - VortexField: a 2-D Lagrangian vortex-particle method. Particles carry
 *   circulation, induce a regularized Biot–Savart velocity field, and are
 *   themselves advected through it with Verlet integration (inertia + drag),
 *   so the smoke's swirls persist and transport like real vorticity.
 *
 * Everything here is pure JS with no DOM/audio dependencies (unit-testable).
 * @module utils/vizPhysics
 */

/**
 * Damped elastic string integrated with position Verlet.
 *
 * Per node i the acceleration combines a spring toward target[i] and the
 * discrete Laplacian of the chain (wave-equation tension):
 *   a_i = stiffness * (target_i - x_i) + tension * (x_{i-1} + x_{i+1} - 2 x_i)
 * and the Verlet update with velocity damping:
 *   x_i' = x_i + (x_i - xPrev_i) * damping + a_i * dt^2
 */
export class VerletChain {
  /**
   * @param {number} count node count
   * @param {object} [opts]
   * @param {number} [opts.stiffness] spring rate toward targets (1/s^2)
   * @param {number} [opts.tension] neighbor coupling rate (1/s^2)
   * @param {number} [opts.damping] velocity retained per step (0..1)
   * @param {number} [opts.initial] initial node value
   */
  constructor(count, { stiffness = 90, tension = 320, damping = 0.9, initial = 0 } = {}) {
    this.count = count;
    this.stiffness = stiffness;
    this.tension = tension;
    this.damping = damping;
    this.positions = new Float32Array(count).fill(initial);
    this.prevPositions = new Float32Array(count).fill(initial);
  }

  /** Snap the chain (and its history) to the given value or array. */
  reset(value) {
    for (let i = 0; i < this.count; i++) {
      const v = typeof value === 'number' ? value : value[i];
      this.positions[i] = v;
      this.prevPositions[i] = v;
    }
  }

  /**
   * Advance the chain toward per-node targets. The explicit stencil has a
   * CFL-style stability bound ((stiffness + tension) * h^2 must stay small),
   * so large frames are split into substeps instead of exploding.
   * @param {ArrayLike<number>} targets length >= count
   * @param {number} dt seconds
   */
  step(targets, dt) {
    const total = Math.min(Math.max(dt, 0.001), 0.1);
    const hMax = Math.sqrt(0.4 / Math.max(1, this.stiffness + this.tension));
    const substeps = Math.min(4, Math.max(1, Math.ceil(total / hMax)));
    const h = total / substeps;
    const h2 = h * h;
    const { positions: x, prevPositions: xp, count } = this;
    const k = this.stiffness;
    const c = this.tension;
    const d = this.damping;
    for (let s = 0; s < substeps; s++) {
      for (let i = 0; i < count; i++) {
        const left = x[i > 0 ? i - 1 : i];
        const right = x[i < count - 1 ? i + 1 : i];
        const accel = k * (targets[i] - x[i]) + c * (left + right - 2 * x[i]);
        const next = x[i] + (x[i] - xp[i]) * d + accel * h2;
        xp[i] = x[i];
        x[i] = Number.isFinite(next) ? next : targets[i];
      }
    }
  }
}

/**
 * Chebyshev nodes of the second kind mapped to [0, 1]: the canonical
 * interpolation grid that keeps Lagrange polynomials well-conditioned.
 * @param {number} n node count (>= 2)
 * @returns {Float64Array} ascending positions in [0, 1]
 */
export const chebyshevNodes = (n) => {
  const nodes = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // cos runs 1 -> -1; flip so nodes ascend from 0 to 1.
    nodes[i] = 0.5 * (1 - Math.cos((Math.PI * i) / (n - 1)));
  }
  return nodes;
};

/**
 * Barycentric Lagrange interpolation (second form): exact on the nodes,
 * numerically stable, O(n) per evaluation after O(n^2) weight setup.
 * @param {ArrayLike<number>} xs strictly increasing node positions
 * @param {ArrayLike<number>} ys node values
 * @returns {(x: number) => number} interpolant defined on [xs[0], xs[n-1]]
 */
export const barycentricLagrange = (xs, ys) => {
  const n = xs.length;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let prod = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) prod *= xs[i] - xs[j];
    }
    w[i] = 1 / prod;
  }
  return (x) => {
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = x - xs[i];
      if (dx === 0) return ys[i];
      const t = w[i] / dx;
      num += t * ys[i];
      den += t;
    }
    return num / den;
  };
};

/**
 * Resample a curve through Lagrange interpolation on Chebyshev nodes:
 * pick control values from `src` at Chebyshev positions, then evaluate the
 * interpolant at `out.length` uniform positions. Distils a noisy series
 * into a smooth envelope while passing exactly through the control points.
 * @param {ArrayLike<number>} src source series
 * @param {Float32Array} out destination (uniform grid)
 * @param {number} [controlCount] Chebyshev control points (default 17)
 */
export const lagrangeEnvelope = (src, out, controlCount = 17) => {
  const n = Math.max(3, Math.min(controlCount, src.length));
  const nodes = chebyshevNodes(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ys[i] = src[Math.round(nodes[i] * (src.length - 1))];
  }
  const evaluate = barycentricLagrange(nodes, ys);
  for (let i = 0; i < out.length; i++) {
    out[i] = evaluate(i / (out.length - 1));
  }
  return out;
};

/**
 * 2-D Lagrangian vortex-particle field.
 *
 * Each particle carries a signed circulation and induces the regularized
 * Biot–Savart velocity of a Lamb–Oseen-style core:
 *   u(p) = strength * perp(r) / (|r|^2 + eps) * (1 - exp(-|r|^2 / rad^2))
 * Particles relax toward the velocity the *other* particles induce at their
 * position (mutual advection) via position Verlet with drag, and their
 * circulation decays exponentially — old swirls die out as new ones arrive.
 * Coordinates live in the shader's centered space (roughly [-1.7, 1.7]^2).
 */
export class VortexField {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxParticles]
   * @param {number} [opts.decay] circulation half-life-ish rate (1/s)
   * @param {number} [opts.inertia] velocity relaxation time constant (s):
   *   how long a particle takes to match the local flow (adds swirl memory)
   * @param {number} [opts.rampTime] seconds over which a new vortex's
   *   *visible* circulation fades in (fillUniforms only; the internal
   *   dynamics use full strength). 0 disables the ramp.
   * @param {() => number} [opts.random] RNG (injectable for tests)
   */
  constructor({
    maxParticles = 16, decay = 0.22, inertia = 0.18, rampTime = 0, random = Math.random
  } = {}) {
    this.maxParticles = maxParticles;
    this.decay = decay;
    this.inertia = inertia;
    this.rampTime = rampTime;
    this.random = random;
    /** @type {Array<{x:number,y:number,px:number,py:number,strength:number,radius:number,age:number}>} */
    this.particles = [];
    this.inducedU = new Float64Array(maxParticles);
    this.inducedV = new Float64Array(maxParticles);
    this.uniformSelection = new Array(maxParticles);
    this.uniformSelectionCount = 0;
  }

  /** Velocity induced at (x, y) by every particle except `skip`. */
  velocityAt(x, y, skip = null) {
    let u = 0;
    let v = 0;
    for (const p of this.particles) {
      if (p === skip) continue;
      const rx = x - p.x;
      const ry = y - p.y;
      const d2 = rx * rx + ry * ry;
      const rad2 = p.radius * p.radius;
      const fall = 1 - Math.exp(-d2 / rad2);
      const scale = p.strength * fall / (d2 + rad2 * 0.25);
      u += -ry * scale;
      v += rx * scale;
    }
    return { u, v };
  }

  /**
   * Spawn a vortex. Evicts the weakest particle when full.
   * @param {{x:number,y:number,strength:number,radius:number}} spec
   */
  inject({ x, y, strength, radius }) {
    if (this.particles.length >= this.maxParticles) {
      let weakest = 0;
      for (let i = 1; i < this.particles.length; i++) {
        if (Math.abs(this.particles[i].strength) < Math.abs(this.particles[weakest].strength)) {
          weakest = i;
        }
      }
      this.particles.splice(weakest, 1);
    }
    this.particles.push({ x, y, px: x, py: y, strength, radius, age: 0 });
  }

  /**
   * Advance the system: mutual Verlet advection + circulation decay.
   * @param {number} dt seconds
   */
  step(dt) {
    const h = Math.min(Math.max(dt, 0.001), 0.05);
    const decayMul = Math.exp(-this.decay * h);
    // Blend factor for relaxing carried velocity toward the induced flow:
    // steady state is exactly dx/dt = u (Lagrangian advection), while the
    // (1 - lambda) memory term keeps arcs curving through field changes.
    const lambda = 1 - Math.exp(-h / this.inertia);
    // Sample velocities first so the update is order-independent. Reuse
    // component buffers instead of allocating one {u, v} object per vortex.
    const { particles, inducedU, inducedV } = this;
    const count = particles.length;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      let u = 0;
      let v = 0;
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const source = particles[j];
        const rx = p.x - source.x;
        const ry = p.y - source.y;
        const d2 = rx * rx + ry * ry;
        const rad2 = source.radius * source.radius;
        const fall = 1 - Math.exp(-d2 / rad2);
        const scale = source.strength * fall / (d2 + rad2 * 0.25);
        u += -ry * scale;
        v += rx * scale;
      }
      inducedU[i] = u;
      inducedV[i] = v;
    }
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const u = inducedU[i];
      const v = inducedV[i];
      const nx = p.x + (p.x - p.px) * (1 - lambda) + u * h * lambda;
      const ny = p.y + (p.y - p.py) * (1 - lambda) + v * h * lambda;
      p.px = p.x;
      p.py = p.y;
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        p.x = nx;
        p.y = ny;
      }
      p.strength *= decayMul;
      p.age += h;
    }
    // Cull spent or escaped vortices by compacting the existing array so the
    // active scene retains one stable particle container across frames.
    let survivorCount = 0;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      if (Math.abs(p.strength) > 0.004 && Math.abs(p.x) < 3 && Math.abs(p.y) < 3) {
        particles[survivorCount] = p;
        survivorCount += 1;
      }
    }
    particles.length = survivorCount;
  }

  /**
   * Write the strongest vortices into flat arrays for shader uniforms.
   * Unused slots get zero strength (the kernel then contributes nothing).
   * @param {Float32Array} positions length 2*slots
   * @param {Float32Array} strengths length slots
   * @param {Float32Array} radii length slots
   */
  fillUniforms(positions, strengths, radii) {
    const slots = strengths.length;
    const count = this.particles.length;
    const sorted = this.uniformSelection;
    // Stable insertion sort over the preallocated selection buffer. With at
    // most 12 particles this is cheaper than copying, sorting, and slicing.
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const magnitude = Math.abs(p.strength);
      let insertAt = i;
      while (
        insertAt > 0
        && Math.abs(sorted[insertAt - 1].strength) < magnitude
      ) {
        sorted[insertAt] = sorted[insertAt - 1];
        insertAt -= 1;
      }
      sorted[insertAt] = p;
    }
    for (let i = count; i < this.uniformSelectionCount; i++) sorted[i] = undefined;
    this.uniformSelectionCount = count;
    for (let i = 0; i < slots; i++) {
      const p = i < count ? sorted[i] : null;
      // Fade new swirls in so they emerge from the smoke instead of popping.
      const ramp = p && this.rampTime > 0 ? Math.min(1, p.age / this.rampTime) : 1;
      positions[i * 2] = p ? p.x : 0;
      positions[i * 2 + 1] = p ? p.y : 0;
      strengths[i] = p ? p.strength * ramp * ramp * (3 - 2 * ramp) : 0;
      radii[i] = p ? p.radius : 1;
    }
  }
}
