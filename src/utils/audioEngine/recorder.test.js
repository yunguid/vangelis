import { describe, expect, it, vi } from 'vitest';
import { RecorderController } from './recorder.js';
import { encodeWav, flattenBuffers } from './wav.js';

/**
 * descent(21): the recorder worklet flushes its final partial buffer AFTER
 * the main thread has already flipped isRecording=false in stop() — the old
 * 'data' guard dropped that flush, silently truncating up to ~46 ms off the
 * tail of every recording. The message sequence below mirrors the real
 * worklet exactly (stop -> final data -> stopped).
 */

const fakeNode = () => ({ port: { postMessage: vi.fn(), onmessage: null } });

const drive = (controller, sequence) => {
  for (const msg of sequence) controller.handlePortMessage(msg);
};

describe('RecorderController stop-flush race', () => {
  it('keeps the final flush that arrives after stop()', () => {
    const onStop = vi.fn();
    const rec = new RecorderController({ onStop });
    rec.node = fakeNode();

    rec.start();
    drive(rec, [{ type: 'data', left: new Float32Array([0.1, 0.2]), right: new Float32Array([0.1, 0.2]) }]);

    rec.stop(); // isRecording -> false, pendingStop -> true (worklet not yet flushed)
    drive(rec, [
      { type: 'data', left: new Float32Array([0.3]), right: new Float32Array([0.3]) }, // final flush
      { type: 'stopped' }
    ]);

    expect(onStop).toHaveBeenCalledTimes(1);
    const wav = rec.exportWav(48000);
    expect(wav).not.toBeNull();
    // 44-byte header + 3 samples x 2 channels x 2 bytes = 56
    expect(wav.byteLength).toBe(44 + 3 * 2 * 2);
  });

  it('still ignores stray data when idle', () => {
    const rec = new RecorderController({});
    rec.node = fakeNode();
    drive(rec, [{ type: 'data', left: new Float32Array([0.5]), right: new Float32Array([0.5]) }]);
    expect(rec.exportWav(48000)).toBeNull();
  });
});

describe('wav encoding', () => {
  it('flattens chunks in order and encodes a valid RIFF header', () => {
    const flat = flattenBuffers([new Float32Array([0.1]), new Float32Array([0.2, 0.3])]);
    expect(Array.from(flat).map((x) => x.toFixed(1))).toEqual(['0.1', '0.2', '0.3']);

    const buf = encodeWav(flat, flat, 48000);
    const view = new DataView(buf);
    const tag = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(tag).toBe('RIFF');
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint32(24, true)).toBe(48000);
  });
});
