#!/usr/bin/env node
/**
 * Render a sampled performance offline, the way the page plays it, to a WAV
 * file: the piece's own arranger picks each note's recording, sample voices
 * are emulated as SampleVoice schedules them (exponential gain ramps, linear
 * playback-rate interpolation, release at the note's end), and the master
 * chain runs with the values applyGlobalParams sets, including the real
 * reverb worklet. Used to compare a performance against its source recording
 * without a browser.
 *
 * A score with `parts` renders too: every part layer runs the real synth
 * worklet (one processor per layer, as the engine makes one node per layer),
 * fed its notes on the audio clock with their expression the way
 * useMidiPlayback hands them over, into a stereo bus at the layer's gain.
 * Notes already sounding at --from start there, entering their expression
 * curves part-way, as a seek starts them.
 *
 * Usage (needs ffmpeg for recordings):
 *   node scripts/render_performance.mjs (--piece <landing piece id> | --score <module.mjs>) --out <file.wav>
 *     [--score <module.mjs>, an ES module exporting async loadScore(root) that
 *      returns the score useMidiPlayback would play: a piece in development]
 *     [--from <s>] [--to <s>] [--midi <draft.mid>, played in place of the piece's file]
 *     [--ambience off, leaves out a piece's ambience bed (its tape hiss)]
 *     [--params '{"reverbMix":0.5}', merged over every note's own settings, for trying a sound]
 *     [--peaks <file.json>, the render's waveform as 480 peak/RMS pairs: the
 *      still picture of the piece the sound dial shows]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import tonejsMidi from '@tonejs/midi';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const MINIMUM_GAIN = 0.0001; // utils/audioEngine/constants.js
const PART_LEAD_SECONDS = 0.06; // useMidiPlayback's SAMPLE_LEAD_SECONDS
// The master limiter (threshold -2.5 dB, ratio 14, knee 0) adds Chrome's
// automatic makeup gain even when it never compresses.
const LIMITER_THRESHOLD_DB = -2.5;
const LIMITER_RATIO = 14;
const LIMITER_MAKEUP_DB = 0.6 * -(LIMITER_THRESHOLD_DB - LIMITER_THRESHOLD_DB / LIMITER_RATIO);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name, fallback = null) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

// ── Worklet and parameter plumbing, as the page sets them ──────────────────

globalThis.sampleRate = SAMPLE_RATE;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
};
const processors = {};
globalThis.registerProcessor = (name, cls) => { processors[name] = cls; };
await import('../src/audio/reverb-worklet.js');
await import('../src/audio/synth-worklet.js');
const {
  AUDIO_PARAM_DEFAULTS, BRIGHTNESS_SHELF_HARMONIC, MUTE_ONSET_SECONDS, sanitizeAudioParams, toWorkletParams
} = await import('../src/utils/audioParams.js');
const { applyGlobalParams, DistortionCurveCache } = await import('../src/utils/audioEngine/effects.js');
const { LANDING_PIECES } = await import('../src/data/landingQueue.js');
const { midiNoteToFrequency } = await import('../src/utils/math.js');

/** The gains, filter settings and reverb parameters applyGlobalParams would set. */
function captureGlobalParams(params) {
  const captured = { gains: {}, reverb: null };
  const param = (name) => ({
    value: 0,
    cancelScheduledValues() {},
    setTargetAtTime(value) { captured.gains[name] = value; },
    setValueAtTime(value) { captured.gains[name] = value; }
  });
  const node = (name) => ({ gain: param(name), frequency: param(`${name}.frequency`), Q: param(`${name}.Q`), pan: param(name), curve: null });
  const nodes = Object.fromEntries([
    'masterGain', 'delaySend', 'delayWet', 'reverbSend', 'reverbWet', 'warmthFilter',
    'presenceFilter', 'postTone', 'airFilter', 'distortion', 'stereoPanner'
  ].map((name) => [name, node(name)]));
  applyGlobalParams({
    params,
    transportTempoBpm: 120,
    ctx: { currentTime: 0 },
    nodes,
    distortionCache: new DistortionCurveCache(),
    delayWorklet: { setParams() {} },
    reverbWorklet: { setParams(value) { captured.reverb = value; } },
    synthWorklet: { setParams() {} }
  });
  return captured;
}

// ── Biquads (Web Audio's formulas) ──────────────────────────────────────────

function biquad(type, frequency, gainDb, q) {
  const w0 = 2 * Math.PI * frequency / SAMPLE_RATE;
  const A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'highpass') {
    // Web Audio reads a highpass Q in dB.
    const alpha = Math.sin(w0) / (2 * 10 ** (q / 20));
    b0 = (1 + Math.cos(w0)) / 2; b1 = -(1 + Math.cos(w0)); b2 = b0;
    a0 = 1 + alpha; a1 = -2 * Math.cos(w0); a2 = 1 - alpha;
  } else if (type === 'peaking') {
    const alpha = Math.sin(w0) / (2 * q);
    b0 = 1 + alpha * A; b1 = -2 * Math.cos(w0); b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * Math.cos(w0); a2 = 1 - alpha / A;
  } else if (type === 'lowshelf' || type === 'highshelf') {
    const alpha = Math.sin(w0) / 2 * Math.SQRT2;
    const sign = type === 'lowshelf' ? 1 : -1;
    const k = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) - sign * (A - 1) * Math.cos(w0) + k);
    b1 = sign * 2 * A * ((A - 1) - sign * (A + 1) * Math.cos(w0));
    b2 = A * ((A + 1) - sign * (A - 1) * Math.cos(w0) - k);
    a0 = (A + 1) + sign * (A - 1) * Math.cos(w0) + k;
    a1 = -sign * 2 * ((A - 1) + sign * (A + 1) * Math.cos(w0));
    a2 = (A + 1) + sign * (A - 1) * Math.cos(w0) - k;
  } else {
    throw new Error(`biquad type ${type}`);
  }
  const c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// ── Recordings ──────────────────────────────────────────────────────────────

// createBuffer for code that builds its own recordings (a piece's tape hiss).
const bufferMaker = {
  sampleRate: SAMPLE_RATE,
  createBuffer: (channels, length, sampleRate) => {
    const data = new Float32Array(length);
    return { sampleRate, length, duration: length / sampleRate, numberOfChannels: 1, getChannelData: () => data };
  }
};

// Deterministic noise, so renders compare exactly.
const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Decode like decodeAudioData: to the context rate, as an AudioBuffer look-alike. */
function decode(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'], { maxBuffer: 2 ** 31 - 1 });
  const data = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  return { sampleRate: SAMPLE_RATE, length: data.length, duration: data.length / SAMPLE_RATE, numberOfChannels: 1, getChannelData: () => data };
}

function readScore(midiPath) {
  const midi = new tonejsMidi.Midi(readFileSync(midiPath));
  const notes = midi.tracks
    .flatMap((track) => track.notes.map((note) => ({
      midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity, channel: track.channel
    })))
    .sort((a, b) => a.time - b.time);
  return { name: midi.name, duration: midi.duration, notes };
}

async function arrange(piece, midiPath) {
  if (piece.transcription === 'pernambuco') {
    const { readGuitarPerformance, arrangePernambuco, pernambucoTake, makeTapeHiss } = await import('../src/data/pernambuco.js');
    const score = readGuitarPerformance(new tonejsMidi.Midi(readFileSync(midiPath)));
    const keys = [...new Set(score.notes.map(pernambucoTake))];
    const buffers = new Map(keys.map((key) => [key, decode(path.join(root, 'public/samples/nylon-guitar', `${key}.mp3`))]));
    return arrangePernambuco(score, buffers, argument('ambience') === 'off' ? null : makeTapeHiss(bufferMaker, seededRandom(1959)));
  }
  const score = readScore(midiPath);
  if (piece.instrument === 'nylon-guitar') {
    const { assignGuitarTakes, arrangeGuitarPerformance } = await import('../src/data/nylonGuitar.js');
    const keys = [...new Set(assignGuitarTakes(score.notes))];
    const buffers = new Map(keys.map((key) => [key, decode(path.join(root, 'public/samples/nylon-guitar', `${key}.mp3`))]));
    return arrangeGuitarPerformance(score, buffers);
  }
  throw new Error(`render_performance: no offline arranger for instrument ${piece.instrument}`);
}

// ── Render ──────────────────────────────────────────────────────────────────

const pieceId = argument('piece');
const scoreModule = argument('score');
const outFile = argument('out');
const piece = LANDING_PIECES.find((entry) => entry.id === pieceId);
if ((!piece && !scoreModule) || !outFile) {
  console.error(`usage: node scripts/render_performance.mjs (--piece <${LANDING_PIECES.map((entry) => entry.id).join('|')}> | --score <module.mjs>) --out <file.wav> [--from <s>] [--to <s>] [--midi <file.mid>]`);
  process.exit(1);
}
const arranged = scoreModule
  ? await (await import(pathToFileURL(path.resolve(scoreModule)).href)).loadScore(root)
  : await arrange(piece, path.resolve(argument('midi', path.join(root, 'public', 'midi', piece.relativePath))));
// As useMidiPlayback: a score without a declared duration ends with its last note.
const duration = arranged.duration ?? Math.max(...arranged.notes.map((note) => note.time + note.duration));
const from = Number(argument('from', 0));
const to = Number(argument('to', duration + 4));
const frames = Math.ceil((to - from) * SAMPLE_RATE);
// Recordings are mono and land on both channels; part synths are stereo.
const busL = new Float32Array(frames);
const busR = new Float32Array(frames);

const trial = JSON.parse(argument('params', '{}'));
// Every note sets the effects chain from its own settings, as on the page.
const noteParams = (note) => sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...(note.audioParams || note.audioParamOverrides), ...trial });
let params = null;
let voices = 0;
for (const note of arranged.notes) {
  const end = note.time + note.duration;
  if (note.part || end < from || note.time > to) continue;
  params = noteParams(note);
  const { buffer, baseFrequency, brightness, mute, gain = 1 } = note.sample;
  const data = buffer.getChannelData(0);
  const frequency = 440 * 2 ** ((note.midi - 69) / 12);
  const rate = frequency / baseFrequency * buffer.sampleRate / SAMPLE_RATE;
  const start = (note.time - from) * SAMPLE_RATE;
  const target = params.volume * Math.min(1, Math.max(0, note.velocity)) * gain;
  const attack = params.attack * SAMPLE_RATE;
  const releaseAt = (end - from) * SAMPLE_RATE;
  const release = params.release * SAMPLE_RATE;
  const stopAt = releaseAt + release + 0.05 * SAMPLE_RATE;
  // SampleVoice's per-stroke high shelf and muted decay (setTargetAtTime).
  const shelf = brightness
    ? biquad('highshelf', Math.min(frequency * BRIGHTNESS_SHELF_HARMONIC, SAMPLE_RATE * 0.45), brightness, 0)
    : null;
  const muteAt = mute > 0 ? Math.max(MUTE_ONSET_SECONDS * SAMPLE_RATE, attack) : Infinity;
  voices += 1;
  // SampleVoice: exponential ramp from the floor to the target over the
  // attack, hold (sustain 1), then an exponential ramp to the floor.
  let gainAtRelease = null;
  for (let frame = Math.max(0, Math.ceil(start)); frame < Math.min(frames, stopAt); frame++) {
    const position = (frame - start) * rate;
    const index = Math.floor(position);
    if (index + 1 >= data.length) break;
    let sample = data[index] + (data[index + 1] - data[index]) * (position - index);
    if (shelf) sample = shelf(sample);
    const elapsed = frame - start;
    let gain = elapsed < attack ? MINIMUM_GAIN * (target / MINIMUM_GAIN) ** (elapsed / attack) : target;
    if (elapsed >= muteAt) gain = MINIMUM_GAIN + (target - MINIMUM_GAIN) * Math.exp(-(elapsed - muteAt) / (mute * SAMPLE_RATE));
    if (frame >= releaseAt) {
      if (gainAtRelease === null) gainAtRelease = gain;
      const t = (frame - releaseAt) / release;
      gain = t >= 1 ? MINIMUM_GAIN : gainAtRelease * (MINIMUM_GAIN / gainAtRelease) ** t;
    }
    const value = sample * gain;
    busL[frame] += value;
    busR[frame] += value;
  }
}
if (arranged.ambience && argument('ambience') !== 'off') {
  // useMidiPlayback runs the bed from the start of playback to the end of the score.
  const { buffer, gain = 1, audioParamOverrides } = arranged.ambience;
  const bedParams = sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...audioParamOverrides, ...trial });
  const data = buffer.getChannelData(0);
  const target = bedParams.volume * gain;
  const endAt = (Math.max(...arranged.notes.map((note) => note.time + note.duration)) - from) * SAMPLE_RATE;
  const release = bedParams.release * SAMPLE_RATE;
  const attack = bedParams.attack * SAMPLE_RATE;
  for (let frame = Math.max(0, Math.ceil(-from * SAMPLE_RATE)); frame < Math.min(frames, endAt + release); frame++) {
    const elapsed = frame + from * SAMPLE_RATE;
    let level = elapsed < attack ? MINIMUM_GAIN * (target / MINIMUM_GAIN) ** (elapsed / attack) : target;
    if (frame >= endAt) level = target * (MINIMUM_GAIN / target) ** ((frame - endAt) / release);
    const value = data[Math.floor(elapsed) % data.length] * level;
    busL[frame] += value;
    busR[frame] += value;
  }
}

// A score's parts: the synth worklet, one processor per layer, each note
// handed over a lead ahead with its `when` and expression, as the engine does.
let partNotes = 0;
if (arranged.parts) {
  // Unison phase jitter and S&H LFOs draw from Math.random: seeded, so renders compare exactly.
  Math.random = seededRandom(1982);
  const Synth = processors['vangelis-synth'];
  const layers = Object.entries(arranged.parts).flatMap(([name, part]) => part.layers.map((layer) => {
    const workletParams = toWorkletParams(sanitizeAudioParams({ ...layer.params, ...trial }));
    const processor = new Synth({ processorOptions: { paramDefaults: workletParams } });
    processor.port.onmessage({ data: { type: 'setParams', params: workletParams } });
    return { name, processor, gain: layer.gain ?? 1, waveform: layer.waveformType || 'sine', messages: [] };
  }));
  arranged.notes.forEach((note, index) => {
    const end = note.time + note.duration;
    if (!note.part || end <= from || note.time >= to) return;
    partNotes += 1;
    params = noteParams(note);
    const noteId = `${note.part}-${index}`;
    const on = Math.max(0, note.time - from);
    const expr = note.expression && { ...note.expression, offset: Math.max(0, from - note.time) };
    for (const layer of layers.filter(({ name }) => name === note.part)) {
      layer.messages.push({
        at: on,
        data: {
          type: 'noteOn',
          noteId,
          frequency: midiNoteToFrequency(note.midi),
          waveform: layer.waveform,
          velocity: Math.min(1, Math.max(0, note.velocity)),
          when: on,
          expr
        }
      }, { at: end - from, data: { type: 'noteOff', noteId, when: end - from } });
    }
  });
  const outL = new Float32Array(BLOCK);
  const outR = new Float32Array(BLOCK);
  for (const layer of layers) {
    layer.messages.sort((a, b) => a.at - b.at);
    let next = 0;
    for (let offset = 0; offset < frames; offset += BLOCK) {
      // The clock the worklet reads its `when`s against.
      globalThis.currentFrame = offset;
      globalThis.currentTime = offset / SAMPLE_RATE;
      while (next < layer.messages.length && layer.messages[next].at - PART_LEAD_SECONDS <= offset / SAMPLE_RATE) {
        layer.processor.port.onmessage({ data: layer.messages[next].data });
        next += 1;
      }
      layer.processor.process([], [[outL, outR]]);
      const count = Math.min(BLOCK, frames - offset);
      for (let i = 0; i < count; i++) {
        busL[offset + i] += outL[i] * layer.gain;
        busR[offset + i] += outR[i] * layer.gain;
      }
    }
  }
}
if (!voices && !partNotes) throw new Error('no notes in range');
params ??= sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...trial });

// Master chain (utils/audioEngine/graph.js) with this piece's settings, per channel.
const captured = captureGlobalParams(params);
const g = captured.gains;
const chains = [0, 1].map(() => [
  biquad('highpass', 28, 0, 0.72),
  biquad('lowshelf', 168, g.warmthFilter, 0.72),
  biquad('peaking', 2400, g.presenceFilter, 0.85),
  biquad('peaking', 540, g.postTone, 0.6),
  biquad('highshelf', 8400, g.airFilter, 0.66)
]);
const buses = [busL, busR];
const Reverb = processors['vangelis-reverb'];
const reverb = new Reverb();
reverb.port.onmessage({ data: { type: 'setParams', params: captured.reverb } });
const left = new Float32Array(frames);
const right = new Float32Array(frames);
const makeup = 10 ** (LIMITER_MAKEUP_DB / 20);
let overThreshold = 0;
for (let offset = 0; offset < frames; offset += BLOCK) {
  const count = Math.min(BLOCK, frames - offset);
  const dry = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
  const send = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
  for (let channel = 0; channel < 2; channel++) {
    for (let i = 0; i < count; i++) {
      let x = buses[channel][offset + i] * 0.92; // headroom
      for (const filter of chains[channel]) x = filter(x);
      dry[channel][i] = x;
      send[channel][i] = x * (g.reverbSend ?? 0);
    }
  }
  const wetLeft = new Float32Array(BLOCK);
  const wetRight = new Float32Array(BLOCK);
  reverb.process([send], [[wetLeft, wetRight]]);
  for (let i = 0; i < count; i++) {
    const wet = g.reverbWet ?? 0;
    const l = (dry[0][i] + wetLeft[i] * wet) * g.masterGain * makeup;
    const r = (dry[1][i] + wetRight[i] * wet) * g.masterGain * makeup;
    if (Math.max(Math.abs(l), Math.abs(r)) > 10 ** (LIMITER_THRESHOLD_DB / 20)) overThreshold += 1;
    left[offset + i] = l;
    right[offset + i] = r;
  }
}

const header = Buffer.alloc(44);
const bytes = frames * 8;
header.write('RIFF', 0); header.writeUInt32LE(36 + bytes, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 8, 28);
header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34);
header.write('data', 36); header.writeUInt32LE(bytes, 40);
const interleaved = new Float32Array(frames * 2);
for (let i = 0; i < frames; i++) { interleaved[2 * i] = left[i]; interleaved[2 * i + 1] = right[i]; }
writeFileSync(outFile, Buffer.concat([header, Buffer.from(interleaved.buffer)]));
let peak = 0;
for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
const peaksFile = argument('peaks');
if (peaksFile) {
  // The waveform as a still picture: per bin, the loudest sample and the RMS,
  // relative to the loudest bin, over the notes' own span.
  const BINS = 480;
  const last = Math.min(frames, Math.ceil((Math.max(...arranged.notes.map((note) => note.time + note.duration)) - from) * SAMPLE_RATE));
  const size = last / BINS;
  const bins = Array.from({ length: BINS }, (_, bin) => {
    let max = 0;
    let energy = 0;
    const a = Math.floor(bin * size);
    const b = Math.floor((bin + 1) * size);
    for (let i = a; i < b; i++) {
      const x = (left[i] + right[i]) / 2;
      max = Math.max(max, Math.abs(x));
      energy += x * x;
    }
    return [max, Math.sqrt(energy / Math.max(1, b - a))];
  });
  const top = Math.max(...bins.map(([max]) => max));
  const round = (value) => Math.round((value / top) * 1000) / 1000;
  writeFileSync(peaksFile, `${JSON.stringify({
    seconds: Math.round((last / SAMPLE_RATE) * 100) / 100,
    peak: bins.map(([max]) => round(max)),
    rms: bins.map(([, rms]) => round(rms))
  })}\n`);
}
console.log(`${outFile}: ${voices} notes${partNotes ? ` + ${partNotes} part notes` : ''}, ${(frames / SAMPLE_RATE).toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS`
  + (overThreshold ? `, ${overThreshold} samples over the limiter threshold (not modelled)` : ''));
