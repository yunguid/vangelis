class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.bufferSize = 2048;
    this.leftBuffer = new Float32Array(this.bufferSize);
    this.rightBuffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      if (data.type === 'start') {
        this.isRecording = true;
        this.bufferIndex = 0;
      } else if (data.type === 'stop') {
        this.isRecording = false;
        this.flush();
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }

  flush() {
    if (this.bufferIndex === 0) return;
    const left = this.leftBuffer.slice(0, this.bufferIndex);
    const right = this.rightBuffer.slice(0, this.bufferIndex);
    this.port.postMessage(
      { type: 'data', left, right },
      [left.buffer, right.buffer]
    );
    this.bufferIndex = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const leftIn = input[0];
    const rightIn = input[1] || input[0];

    if (output && output.length) {
      const leftOut = output[0];
      const rightOut = output[1] || output[0];
      for (let i = 0; i < leftIn.length; i++) {
        leftOut[i] = leftIn[i];
        if (rightOut) {
          rightOut[i] = rightIn[i];
        }
      }
    }

    if (this.isRecording) {
      for (let i = 0; i < leftIn.length; i++) {
        this.leftBuffer[this.bufferIndex] = leftIn[i];
        this.rightBuffer[this.bufferIndex] = rightIn[i];
        this.bufferIndex += 1;
        if (this.bufferIndex >= this.bufferSize) {
          this.flush();
        }
      }
    }

    return true;
  }
}

registerProcessor('vangelis-recorder', RecorderProcessor);
