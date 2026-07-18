import { describe, expect, it } from 'vitest';
import {
  VerletChain,
  VortexField,
  barycentricLagrange,
  chebyshevNodes,
  createLagrangeEnvelopePlan,
  sampleLagrangeEnvelope,
  lagrangeEnvelope
} from './vizPhysics.js';

describe('chebyshevNodes', () => {
  it('spans [0, 1], ascending, denser at the edges', () => {
    const nodes = chebyshevNodes(9);
    expect(nodes[0]).toBeCloseTo(0, 12);
    expect(nodes[8]).toBeCloseTo(1, 12);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i]).toBeGreaterThan(nodes[i - 1]);
    }
    // Edge spacing < center spacing (Chebyshev clustering)
    expect(nodes[1] - nodes[0]).toBeLessThan(nodes[5] - nodes[4]);
  });
});

describe('barycentricLagrange', () => {
  it('passes exactly through its nodes', () => {
    const xs = [0, 0.3, 0.55, 0.8, 1];
    const ys = [2, -1, 4, 0.5, 3];
    const f = barycentricLagrange(xs, ys);
    xs.forEach((x, i) => expect(f(x)).toBeCloseTo(ys[i], 10));
  });

  it('reproduces polynomials of degree < n exactly (between nodes too)', () => {
    const poly = (x) => 3 * x * x * x - 2 * x * x + x - 5;
    const xs = chebyshevNodes(6);
    const ys = [...xs].map(poly);
    const f = barycentricLagrange(xs, ys);
    for (const x of [0.13, 0.42, 0.71, 0.97]) {
      expect(f(x)).toBeCloseTo(poly(x), 8);
    }
  });

  it('stays bounded on Chebyshev nodes for a step-like series (no Runge blow-up)', () => {
    const xs = chebyshevNodes(17);
    const ys = [...xs].map((x) => (x < 0.5 ? -60 : -10));
    const f = barycentricLagrange(xs, ys);
    for (let i = 0; i <= 100; i++) {
      const v = f(i / 100);
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(200);
    }
  });
});

describe('lagrangeEnvelope', () => {
  it('fills the output with a finite smooth curve matching endpoints', () => {
    const src = new Float32Array(96).map((_, i) => -70 + 60 * Math.exp(-((i - 40) ** 2) / 200));
    const out = new Float32Array(128);
    lagrangeEnvelope(src, out, 17);
    expect(out.every(Number.isFinite)).toBe(true);
    expect(out[0]).toBeCloseTo(src[0], 4);
    expect(out[out.length - 1]).toBeCloseTo(src[src.length - 1], 4);
    // Envelope peaks near the source peak
    const peakIdx = out.indexOf(Math.max(...out));
    expect(Math.abs(peakIdx / out.length - 40 / 96)).toBeLessThan(0.15);
  });

  it('reuses a plan while matching the allocating envelope exactly', () => {
    const src = Float32Array.from(
      { length: 96 },
      (_, index) => -70 + 60 * Math.sin((index / 95) * Math.PI) ** 2
    );
    const legacyOut = new Float32Array(96);
    const plannedOut = new Float32Array(96);
    const plan = createLagrangeEnvelopePlan({
      sourceLength: src.length,
      outputLength: plannedOut.length,
      controlCount: 21
    });
    const controlValues = plan.controlValues;
    const terms = plan.terms;

    lagrangeEnvelope(src, legacyOut, 21);
    sampleLagrangeEnvelope(src, plannedOut, plan);

    expect([...plannedOut]).toEqual([...legacyOut]);
    sampleLagrangeEnvelope(src, plannedOut, plan);
    expect(plan.controlValues).toBe(controlValues);
    expect(plan.terms).toBe(terms);
  });
});

describe('VerletChain', () => {
  it('settles onto a constant target', () => {
    const chain = new VerletChain(32, { stiffness: 120, tension: 200, damping: 0.86 });
    const targets = new Float32Array(32).fill(0.7);
    for (let i = 0; i < 600; i++) chain.step(targets, 1 / 60);
    for (const x of chain.positions) expect(x).toBeCloseTo(0.7, 2);
  });

  it('overshoots a step (it is a spring, not a low-pass)', () => {
    const chain = new VerletChain(8, { stiffness: 150, tension: 0, damping: 0.97 });
    const targets = new Float32Array(8).fill(1);
    let maxSeen = 0;
    for (let i = 0; i < 300; i++) {
      chain.step(targets, 1 / 60);
      maxSeen = Math.max(maxSeen, chain.positions[3]);
    }
    expect(maxSeen).toBeGreaterThan(1.02);
  });

  it('propagates a local pluck to neighbors through tension', () => {
    const chain = new VerletChain(64, { stiffness: 0, tension: 400, damping: 1 });
    chain.reset(0);
    chain.positions[32] = 1; // pluck the middle (prev stays 0 = impulse)
    const targets = new Float32Array(64).fill(0);
    for (let i = 0; i < 30; i++) chain.step(targets, 1 / 60);
    let sideEnergy = 0;
    for (let i = 40; i < 56; i++) sideEnergy += Math.abs(chain.positions[i]);
    expect(sideEnergy).toBeGreaterThan(0.01);
  });

  it('never produces NaN under erratic targets and dt spikes', () => {
    const chain = new VerletChain(48);
    const targets = new Float32Array(48);
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let step = 0; step < 400; step++) {
      for (let i = 0; i < targets.length; i++) targets[i] = (rand() - 0.5) * 120;
      chain.step(targets, step % 17 === 0 ? 0.5 : 1 / 60);
    }
    expect([...chain.positions].every(Number.isFinite)).toBe(true);
  });
});

describe('VortexField', () => {
  it('matches the former allocating step kernel', () => {
    const field = new VortexField({ maxParticles: 4, decay: 0.12, inertia: 0.18 });
    const specs = [
      { x: -0.6, y: 0.1, strength: 0.21, radius: 0.55 },
      { x: 0.4, y: -0.2, strength: -0.18, radius: 0.48 },
      { x: 0.1, y: 0.5, strength: 0.09, radius: 0.63 }
    ];
    specs.forEach((spec) => field.inject(spec));
    let legacy = field.particles.map((particle) => ({ ...particle }));
    const dt = 1 / 60;

    for (let frame = 0; frame < 30; frame++) {
      const h = Math.min(Math.max(dt, 0.001), 0.05);
      const decayMul = Math.exp(-field.decay * h);
      const lambda = 1 - Math.exp(-h / field.inertia);
      const induced = legacy.map((particle) => {
        let u = 0;
        let v = 0;
        for (const source of legacy) {
          if (source === particle) continue;
          const rx = particle.x - source.x;
          const ry = particle.y - source.y;
          const d2 = rx * rx + ry * ry;
          const rad2 = source.radius * source.radius;
          const fall = 1 - Math.exp(-d2 / rad2);
          const scale = source.strength * fall / (d2 + rad2 * 0.25);
          u += -ry * scale;
          v += rx * scale;
        }
        return { u, v };
      });
      legacy.forEach((particle, index) => {
        const { u, v } = induced[index];
        const nx = particle.x
          + (particle.x - particle.px) * (1 - lambda)
          + u * h * lambda;
        const ny = particle.y
          + (particle.y - particle.py) * (1 - lambda)
          + v * h * lambda;
        particle.px = particle.x;
        particle.py = particle.y;
        particle.x = nx;
        particle.y = ny;
        particle.strength *= decayMul;
        particle.age += h;
      });
      legacy = legacy.filter(
        (particle) => Math.abs(particle.strength) > 0.004
          && Math.abs(particle.x) < 3
          && Math.abs(particle.y) < 3
      );
      field.step(dt);
    }

    expect(field.particles).toHaveLength(legacy.length);
    field.particles.forEach((particle, index) => {
      expect(particle).toEqual(legacy[index]);
    });
  });

  it('a single vortex induces rotation with the sign of its circulation', () => {
    const field = new VortexField({ random: () => 0.5 });
    field.inject({ x: 0, y: 0, strength: 1.5, radius: 0.5 });
    // At (1, 0) a positive vortex at origin should push +y (counterclockwise)
    const { u, v } = field.velocityAt(1, 0);
    expect(v).toBeGreaterThan(0);
    expect(Math.abs(u)).toBeLessThan(1e-9);
    field.particles[0].strength = -1.5;
    expect(field.velocityAt(1, 0).v).toBeLessThan(0);
  });

  it('circulation decays and spent vortices are culled', () => {
    const field = new VortexField({ decay: 3, random: () => 0.5 });
    field.inject({ x: 0, y: 0, strength: 0.2, radius: 0.4 });
    for (let i = 0; i < 120; i++) field.step(1 / 60);
    expect(field.particles.length).toBe(0);
  });

  it('caps the particle count by evicting the weakest', () => {
    const field = new VortexField({ maxParticles: 4, random: () => 0.5 });
    for (let i = 0; i < 8; i++) {
      field.inject({ x: i * 0.1, y: 0, strength: 0.1 * (i + 1), radius: 0.4 });
    }
    expect(field.particles.length).toBe(4);
    const strengths = field.particles.map((p) => p.strength);
    expect(Math.min(...strengths)).toBeGreaterThanOrEqual(0.5);
  });

  it('two like-signed vortices orbit each other (mutual Lagrangian advection)', () => {
    const field = new VortexField({ decay: 0, random: () => 0.5 });
    field.inject({ x: -0.3, y: 0, strength: 1, radius: 0.3 });
    field.inject({ x: 0.3, y: 0, strength: 1, radius: 0.3 });
    const startAngle = Math.atan2(0 - 0, 0.3 - -0.3);
    for (let i = 0; i < 60; i++) field.step(1 / 60);
    const [a, b] = field.particles;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    expect(field.particles.length).toBe(2);
    expect(Math.abs(angle - startAngle)).toBeGreaterThan(0.15);
    expect([a.x, a.y, b.x, b.y].every(Number.isFinite)).toBe(true);
  });

  it('fillUniforms writes the strongest vortices and zeros spare slots', () => {
    const field = new VortexField({ random: () => 0.5 });
    field.inject({ x: 0.1, y: 0.2, strength: 0.3, radius: 0.4 });
    field.inject({ x: -0.5, y: 0.1, strength: -0.9, radius: 0.5 });
    const pos = new Float32Array(8);
    const str = new Float32Array(4);
    const rad = new Float32Array(4);
    field.fillUniforms(pos, str, rad);
    expect(str[0]).toBeCloseTo(-0.9, 6);
    expect(pos[0]).toBeCloseTo(-0.5, 6);
    expect(str[2]).toBe(0);
    expect(str[3]).toBe(0);
  });

  it('reuses step and uniform-selection storage across active frames', () => {
    const field = new VortexField({ maxParticles: 4, decay: 0, random: () => 0.5 });
    field.inject({ x: -0.4, y: 0, strength: 0.2, radius: 0.5 });
    field.inject({ x: 0.4, y: 0, strength: -0.3, radius: 0.5 });
    const particles = field.particles;
    const inducedU = field.inducedU;
    const inducedV = field.inducedV;
    const uniformSelection = field.uniformSelection;
    const pos = new Float32Array(8);
    const str = new Float32Array(4);
    const rad = new Float32Array(4);

    for (let frame = 0; frame < 10; frame++) {
      field.step(1 / 60);
      field.fillUniforms(pos, str, rad);
    }

    expect(field.particles).toBe(particles);
    expect(field.inducedU).toBe(inducedU);
    expect(field.inducedV).toBe(inducedV);
    expect(field.uniformSelection).toBe(uniformSelection);
  });

  it('keeps equal-strength uniform selection stable', () => {
    const field = new VortexField({ maxParticles: 4, decay: 0, random: () => 0.5 });
    field.inject({ x: 0.1, y: 0, strength: 0.5, radius: 0.4 });
    field.inject({ x: 0.2, y: 0, strength: -0.5, radius: 0.4 });
    field.inject({ x: 0.3, y: 0, strength: 0.8, radius: 0.4 });
    const pos = new Float32Array(6);
    const str = new Float32Array(3);
    const rad = new Float32Array(3);

    field.fillUniforms(pos, str, rad);

    expect(str[0]).toBeCloseTo(0.8, 6);
    expect(str[1]).toBeCloseTo(0.5, 6);
    expect(str[2]).toBeCloseTo(-0.5, 6);
    expect(pos[0]).toBeCloseTo(0.3, 6);
    expect(pos[2]).toBeCloseTo(0.1, 6);
    expect(pos[4]).toBeCloseTo(0.2, 6);
  });

  it('releases reusable selection references after particles are culled', () => {
    const field = new VortexField({ maxParticles: 2, decay: 0 });
    field.inject({ x: 0, y: 0, strength: 0.3, radius: 0.4 });
    field.inject({ x: 0.5, y: 0, strength: -0.2, radius: 0.4 });
    const pos = new Float32Array(4);
    const str = new Float32Array(2);
    const rad = new Float32Array(2);
    field.fillUniforms(pos, str, rad);
    field.particles.forEach((particle) => { particle.strength = 0; });

    field.step(1 / 60);
    field.fillUniforms(pos, str, rad);

    expect(field.particles).toHaveLength(0);
    expect(field.uniformSelection[0]).toBeUndefined();
    expect(field.uniformSelection[1]).toBeUndefined();
    expect([...str]).toEqual([0, 0]);
  });
});
