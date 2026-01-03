import '@testing-library/jest-dom';

// Mock WebGL context for Three.js tests
HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === 'webgl' || type === 'webgl2') {
    return {
      canvas: this,
      getExtension: () => null,
      getParameter: () => 1,
      getShaderPrecisionFormat: () => ({ precision: 1 }),
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      enable: () => {},
      disable: () => {},
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      drawArrays: () => {},
      createTexture: () => ({}),
      bindTexture: () => {},
      texParameteri: () => {},
      texImage2D: () => {},
      getUniformLocation: () => ({}),
      uniform1f: () => {},
      uniform1i: () => {},
      uniform2f: () => {},
      uniform3f: () => {},
      uniform4f: () => {},
      uniformMatrix4fv: () => {},
      getAttribLocation: () => 0,
      deleteShader: () => {},
      deleteProgram: () => {},
      deleteBuffer: () => {},
      deleteTexture: () => {},
    };
  }
  return null;
};

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.destination = { channelCount: 2 };
  }
  createGain() { return { gain: { value: 1 }, connect: () => {} }; }
  createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 440 } }; }
  createAnalyser() { return { connect: () => {}, fftSize: 2048, getByteTimeDomainData: () => {} }; }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
