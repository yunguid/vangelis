#!/usr/bin/env node
/**
 * Smoke tests for the synth worklet, run against the real processor code.
 * Fails (exit 1) on any regression in core playback behavior.
 */

const SR = 48000;
const BLOCK = 128;

globalThis.sampleRate = SR;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
};
let ProcessorClass = null;
globalThis.registerProcessor = (_name, cls) => {
  ProcessorClass = cls;
};

await import('../src/audio/synth-worklet.js');
const { FACTORY_PRESETS } = await import('../src/utils/factoryPresets.js');
const { sanitizeAudioParams, toWorkletParams } = await import('../src/utils/audioParams.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok: ${name}`);
  } else {
    failures++;
    console.error(`FAIL: ${name} ${detail}`);
  }
}

function makeProc(params = {}) {
  return new ProcessorClass({ processorOptions: { paramDefaults: params } });
}

function render(proc, blocks) {
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];
  let peak = 0;
  let last = new Float32Array(BLOCK);
  let allFinite = true;
  for (let i = 0; i < blocks; i++) {
    proc.process([], outputs);
    for (let j = 0; j < BLOCK; j++) {
      const a = Math.abs(left[j]);
      if (!Number.isFinite(left[j])) allFinite = false;
      if (a > peak) peak = a;
    }
    last.set(left);
  }
  return { peak, last, allFinite };
}

function msg(proc, data) {
  proc.port.onmessage({ data });
}

// --- 1. Basic note produces sound, release decays to silence ---
{
  console.log('basic playback:');
  const proc = makeProc();
  msg(proc, { type: 'noteOn', noteId: 'n1', frequency: 440, waveform: 'saw', velocity: 1 });
  const a = render(proc, 40); // ~106ms
  check('note produces output', a.peak > 0.01, `peak=${a.peak}`);
  check('output finite', a.allFinite);
  check('output bounded', a.peak < 1.0, `peak=${a.peak}`);
  msg(proc, { type: 'noteOff', noteId: 'n1' });
  const b = render(proc, 600); // ~1.6s >> release 0.3
  const tail = render(proc, 10);
  check('silent after release', tail.peak < 1e-4, `peak=${tail.peak}`);
}

// --- 2. All four waveforms ---
{
  console.log('waveforms:');
  for (const wf of ['sine', 'saw', 'square', 'triangle']) {
    const proc = makeProc();
    msg(proc, { type: 'noteOn', noteId: 'w', frequency: 880, waveform: wf, velocity: 1 });
    const r = render(proc, 40);
    check(`${wf} sounds and is bounded`, r.peak > 0.01 && r.peak <= 1.0 && r.allFinite, `peak=${r.peak}`);
  }
}

// --- 3. FM + filter + unison all engaged ---
{
  console.log('fm+filter+unison:');
  const proc = makeProc({
    useFM: true, fmRatio: 2, fmIndex: 5,
    useFilter: true, filterCutoff: 2000, filterResonance: 3,
    unisonVoices: 4, unisonDetune: 15
  });
  msg(proc, { type: 'noteOn', noteId: 'f', frequency: 220, waveform: 'saw', velocity: 1 });
  const r = render(proc, 100);
  check('complex patch sounds', r.peak > 0.01 && r.allFinite, `peak=${r.peak}`);
}

// --- 4. Legacy LFO params still modulate (vibrato changes the signal) ---
{
  console.log('legacy lfo mapping:');
  const base = makeProc();
  msg(base, { type: 'noteOn', noteId: 'l', frequency: 440, waveform: 'sine', velocity: 1 });
  render(base, 200);
  const dry = render(base, 50);

  const lfo = makeProc({ lfoRate: 8, lfoDepth: 1, lfoTarget: 2 }); // amp tremolo
  msg(lfo, { type: 'noteOn', noteId: 'l', frequency: 440, waveform: 'sine', velocity: 1 });
  render(lfo, 200);
  // Measure amplitude variance over time: tremolo should fluctuate block peaks
  const peaks = [];
  const left = new Float32Array(BLOCK);
  const outputs = [[left, left]];
  for (let i = 0; i < 60; i++) {
    lfo.process([], outputs);
    let p = 0;
    for (let j = 0; j < BLOCK; j++) p = Math.max(p, Math.abs(left[j]));
    peaks.push(p);
  }
  const minP = Math.min(...peaks);
  const maxP = Math.max(...peaks);
  check('legacy amp LFO produces tremolo', maxP > minP * 1.5, `min=${minP} max=${maxP}`);
}

// --- 5. Mod matrix route: mod wheel -> pitch ---
{
  console.log('mod matrix:');
  const proc = makeProc({ modRoutes: [{ src: 6, dst: 0, depth: 1 }] }); // wheel -> pitch
  msg(proc, { type: 'noteOn', noteId: 'm', frequency: 220, waveform: 'sine', velocity: 1 });
  render(proc, 100);
  // Estimate frequency via zero crossings without wheel
  const countZC = (buf) => {
    let zc = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
    }
    return zc;
  };
  const left = new Float32Array(2048);
  const seg = new Float32Array(BLOCK);
  const outputs = [[seg, seg]];
  const grab = () => {
    for (let i = 0; i < 16; i++) {
      proc.process([], outputs);
      left.set(seg, i * BLOCK);
    }
    return countZC(left);
  };
  const zcBefore = grab();
  msg(proc, { type: 'modWheel', value: 1 }); // +12 semitones at depth 1
  render(proc, 100); // let smoothing settle
  const zcAfter = grab();
  check('wheel->pitch route raises pitch ~2x', zcAfter > zcBefore * 1.7 && zcAfter < zcBefore * 2.3,
    `zc ${zcBefore} -> ${zcAfter}`);
}

// --- 6. Pitch bend ---
{
  console.log('pitch bend:');
  const proc = makeProc();
  msg(proc, { type: 'noteOn', noteId: 'b', frequency: 220, waveform: 'sine', velocity: 1 });
  render(proc, 100);
  const countZC = (buf) => {
    let zc = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
    }
    return zc;
  };
  const left = new Float32Array(4096);
  const seg = new Float32Array(BLOCK);
  const outputs = [[seg, seg]];
  const grab = () => {
    for (let i = 0; i < 32; i++) {
      proc.process([], outputs);
      left.set(seg, i * BLOCK);
    }
    return countZC(left);
  };
  const before = grab();
  msg(proc, { type: 'pitchBend', value: 12 });
  render(proc, 100);
  const after = grab();
  check('+12st bend doubles frequency', after > before * 1.8 && after < before * 2.2,
    `zc ${before} -> ${after}`);
}

// --- 7. Glide ---
{
  console.log('glide:');
  const proc = makeProc({ glideTime: 0.3 });
  msg(proc, { type: 'noteOn', noteId: 'g1', frequency: 220, waveform: 'sine', velocity: 1 });
  render(proc, 200);
  msg(proc, { type: 'noteOff', noteId: 'g1' });
  msg(proc, { type: 'noteOn', noteId: 'g2', frequency: 880, waveform: 'sine', velocity: 1 });
  // Immediately after the new note, glide means pitch should still be near 220,
  // i.e. well below 880.
  const countZC = (buf) => {
    let zc = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
    }
    return zc;
  };
  const left = new Float32Array(1024);
  const seg = new Float32Array(BLOCK);
  const outputs = [[seg, seg]];
  for (let i = 0; i < 8; i++) {
    proc.process([], outputs);
    left.set(seg, i * BLOCK);
  }
  const zcEarly = countZC(left); // ~21ms window
  render(proc, 600); // glide fully settles (~1.6s >> 0.3s)
  for (let i = 0; i < 8; i++) {
    proc.process([], outputs);
    left.set(seg, i * BLOCK);
  }
  const zcLate = countZC(left);
  // 220Hz over 21.3ms ~= 4.7 crossings; 880Hz ~= 18.8
  check('glide starts near old pitch', zcEarly < 12, `zcEarly=${zcEarly}`);
  check('glide settles at new pitch', zcLate >= 15, `zcLate=${zcLate}`);
}

// --- 8. Velocity curve ---
{
  console.log('velocity curve:');
  const flat = makeProc({ velocityCurve: 0 });
  const hard = makeProc({ velocityCurve: 1 });
  for (const [name, proc] of [['flat', flat], ['hard', hard]]) {
    msg(proc, { type: 'noteOn', noteId: 'v', frequency: 440, waveform: 'sine', velocity: 0.5 });
    render(proc, 200);
  }
  const peakOf = (proc) => render(proc, 20).peak;
  const pFlat = peakOf(flat);
  const pHard = peakOf(hard);
  // hard curve: 0.5^4 = 0.0625 vs flat 0.5 -> much quieter
  check('hard curve attenuates soft notes', pHard < pFlat * 0.4, `flat=${pFlat} hard=${pHard}`);
}

// --- 9. Voice stealing under flood ---
{
  console.log('factory presets:');
  for (const preset of FACTORY_PRESETS) {
    const params = toWorkletParams(sanitizeAudioParams(preset.audioParams));
    const proc = makeProc(params);
    msg(proc, { type: 'setParams', params });
    for (let i = 0; i < 18; i++) {
      msg(proc, {
        type: 'noteOn',
        noteId: `${preset.id}-${i}`,
        frequency: 130.81 * Math.pow(2, i / 12),
        waveform: preset.waveformType,
        velocity: 0.95
      });
      render(proc, 3);
    }
    const r = render(proc, 80);
    check(`${preset.name} stays finite and bounded`, r.allFinite && r.peak <= 1.0, `peak=${r.peak}`);
  }
}

// --- 10. Voice stealing under flood ---
{
  console.log('voice stealing:');
  const proc = makeProc();
  for (let i = 0; i < 64; i++) {
    msg(proc, { type: 'noteOn', noteId: `s${i}`, frequency: 100 + i * 20, waveform: 'saw', velocity: 1 });
    render(proc, 2);
  }
  const r = render(proc, 50);
  check('64 noteOns over 24 voices stays bounded & finite', r.allFinite && r.peak <= 1.0, `peak=${r.peak}`);
  msg(proc, { type: 'allNotesOff' });
  render(proc, 800);
  const tail = render(proc, 10);
  check('allNotesOff silences', tail.peak < 1e-4, `peak=${tail.peak}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
