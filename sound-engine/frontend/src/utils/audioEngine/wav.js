export function flattenBuffers(buffers) {
  if (!buffers.length) return new Float32Array(0);
  let totalLength = 0;
  for (const chunk of buffers) {
    totalLength += chunk.length;
  }
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of buffers) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function encodeWav(left, right, sampleRate) {
  const numChannels = right && right.length ? 2 : 1;
  const length = left.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * blockAlign, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const leftSample = Math.max(-1, Math.min(1, left[i]));
    const leftInt = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7fff;
    view.setInt16(offset, leftInt, true);
    offset += 2;

    if (numChannels === 2) {
      const rightSample = Math.max(-1, Math.min(1, right[i] ?? left[i]));
      const rightInt = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7fff;
      view.setInt16(offset, rightInt, true);
      offset += 2;
    }
  }

  return buffer;
}
