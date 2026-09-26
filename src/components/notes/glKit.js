/**
 * The little WebGL2 the notes styles share: programs, instanced quads,
 * offscreen targets and a few GLSL helpers. No library: every style is a
 * handful of draw calls straight on the GPU.
 */

// A triangle that covers the viewport; `vUv` runs 0..1 across it.
export const FULLSCREEN_VERTEX = `#version 300 es
const vec2 CORNERS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 corner = CORNERS[gl_VertexID];
  vUv = corner * 0.5 + 0.5;
  gl_Position = vec4(corner, 0.0, 1.0);
}
`;

// Hash, value noise and fbm for paper, sky, smoke and grain.
export const GLSL_NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise(p);
    p = p * 2.02 + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum;
}
`;

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Notes shader failed to compile: ${info}`);
  }
  return shader;
};

/** A linked program with its uniform locations looked up by name. */
export const createProgram = (gl, vertexSource, fragmentSource, uniformNames = []) => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Notes program failed to link: ${info}`);
  }
  const uniforms = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
};

/**
 * Per-instance float attributes in one buffer, bound in a VAO. `layout` lists
 * [attributeName, size] in packing order; styles write `data` and upload the
 * first `count` instances each frame, then draw a 4-vertex strip per instance
 * (the corner is `vec2(gl_VertexID & 1, gl_VertexID >> 1)` in the shader).
 */
export const createInstances = (gl, program, layout, capacity) => {
  const stride = layout.reduce((total, [, size]) => total + size, 0);
  const data = new Float32Array(stride * capacity);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  let offset = 0;
  for (const [name, size] of layout) {
    const location = gl.getAttribLocation(program, name);
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
      gl.vertexAttribDivisor(location, 1);
    }
    offset += size;
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    stride,
    capacity,
    data,
    vao,
    upload(count) {
      if (count <= 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * stride);
    },
    /** Uploads instances [first, first + count) only, for ring buffers. */
    uploadRange(first, count) {
      if (count <= 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, first * stride * 4, data, first * stride, count * stride);
    },
    draw(count) {
      if (count <= 0) return;
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    }
  };
};

// An empty VAO for passes that make their vertices from gl_VertexID alone.
export const createEmptyVao = (gl) => gl.createVertexArray();

const halfFloatSupport = new WeakMap();

/** RGBA16F where the GPU can render to it (HDR accumulation), else RGBA8. */
const canRenderHalfFloat = (gl) => {
  if (!halfFloatSupport.has(gl)) {
    halfFloatSupport.set(gl, Boolean(gl.getExtension('EXT_color_buffer_float')
      || gl.getExtension('EXT_color_buffer_half_float')));
  }
  return halfFloatSupport.get(gl);
};

/**
 * An offscreen colour target (texture + framebuffer), sized with `resize`;
 * `hdr` asks for half floats when they can be rendered to.
 */
export const createTarget = (gl, { hdr = false, linear = true } = {}) => {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const useHalf = hdr && canRenderHalfFloat(gl);
  const target = {
    texture,
    framebuffer,
    width: 0,
    height: 0,
    hdr: useHalf,
    resize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (w === target.width && h === target.height) return false;
      target.width = w;
      target.height = h;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (useHalf) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      const filter = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return true;
    },
    /** Binds it as the render target with a matching viewport. */
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

/** Draw to the canvas itself, across all of it. */
export const bindCanvas = (gl, frame) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, frame.pixelWidth, frame.pixelHeight);
};

/** Leaves the context the way a newly created one starts, between styles. */
export const resetGlState = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.CULL_FACE);
  gl.blendFunc(gl.ONE, gl.ZERO);
  gl.blendEquation(gl.FUNC_ADD);
  gl.clearColor(0, 0, 0, 1);
};
