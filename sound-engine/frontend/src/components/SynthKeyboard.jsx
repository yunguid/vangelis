import React, { useEffect, useState } from 'react';
import init, { wasm_generate_waveform, WasmWaveform } from '/public/pkg/sound_engine.js';

const sampleRate = 44100;
const notes = {
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
  'F4': 349.23, 'G4': 392.00, 'A4': 440.00,
  'B4': 493.88, 'C5': 523.25
};

const SynthKeyboard = () => {
  const [waveform, setWaveform] = useState(WasmWaveform.Sine);
  const [wasmLoaded, setWasmLoaded] = useState(false);

  useEffect(() => {
    init().then(() => setWasmLoaded(true));
  }, []);

  const playNote = (freq) => {
    if (!wasmLoaded) return;
    const samples = wasm_generate_waveform(waveform, freq, 1.0, sampleRate);
    const audioCtx = new AudioContext();
    const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  };

  return (
    <div>
      <div>
        {["Sine", "Sawtooth", "Square", "Triangle"].map(wave =>
          <button key={wave} onClick={() => setWaveform(WasmWaveform[wave])}>
            {wave}
          </button>
        )}
      </div>
      <div>
        {Object.entries(notes).map(([note, freq]) => (
          <div key={note} className="key" onClick={() => playNote(freq)}>
            {note}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SynthKeyboard;
