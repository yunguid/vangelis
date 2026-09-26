/**
 * "Blade Runner Blues" (Vangelis, 1982; the EastWest album, 1994), rebuilt on the app's own
 * synthesizer: a transcription of the record played by patches designed here to sound like
 * the Yamaha CS-80 and the pad under it. How it was made, and how close it is, is logged in
 * docs/replicas/blade-runner-blues/JOURNEY.md.
 *
 * The MIDI file carries the performance on the record's own timeline, one track per voice
 * (a note slot), so every note brings its own curves: its pitch bend (range set by RPN 0)
 * is its pitch as the record has it, cents from A440 including the scoop into it, its bends
 * and its vibrato (the record sits 11.6 cents sharp); its CC 11 is its loudness, (value -
 * 127) / 2 dB; velocity is its peak. The CS-80's voices are on channels 1-12, the pad's on
 * 13-14, the low bed's on 15 and the bass's on 16 (voices of the last three share a
 * channel, so a standard player hears their curves as one).
 */
import { MOD_DST, MOD_SRC } from '../audio/dsp/constants.js';

// Curves are handed to the synth at this rate (points per second of a note), fewer for
// notes so long that a curve would pass MAX_CURVE_POINTS (the low bed holds for minutes).
export const BRB_EXPRESSION_RATE = 100;
const MAX_CURVE_POINTS = 12000;

const partOfChannel = (channel) => (
  channel < 12 ? 'cs80' : channel < 14 ? 'pad' : channel === 14 ? 'rumble' : channel === 15 ? 'bass' : null
);

// The CS-80's two channels per key, as the record's lead measures: its harmonics run clean
// to 16 kHz, falling like a sawtooth's under a fundamental that stands out - a sine straight
// to the amplifier (the CS-80's sine lever) beside a sawtooth, low-passed near 9.5 kHz. The
// saw starts half a cycle on, so its fundamental adds to the sine's (a rising ramp's
// fundamental is the sine's upside down). Up the keyboard the record's lead gets darker (its
// second harmonic 10.5 dB under the first from G3 to F4, 18 dB from D6 up), so the sine
// grows with the key: x0.875 at A3, x1.5 at C5, x2 from C6. Swells, scoops and vibrato are
// each note's own curves; the envelopes only open and close them.
const CS80_SINE = {
  attack: 0.005, decay: 0.2, sustain: 1, release: 0.9, useFilter: false, unisonVoices: 1,
  modRoutes: [{ src: MOD_SRC.KEY_TRACK, dst: MOD_DST.AMP, depth: 1 }]
};
const CS80_SAW = {
  attack: 0.005, decay: 0.2, sustain: 1, release: 0.9, phaseOffset: 180, useFilter: true,
  filterMode: 0, filterCutoff: 9500, filterResonance: 1.2, unisonVoices: 1
};
// The pad under it, read at the harmonics no equal-tempered note can sit on (F#2's 7th, 13th
// and 14th, 80-91.5 s: 18-27 dB under its fundamental, where an FM'd sine has nothing): a
// sine beside a half-cycle-shifted sawtooth low-passed at 5 kHz, two voices 3 cents apart.
// Each note carries the record's swell as its loudness curve.
const PAD_SINE = {
  attack: 0.08, decay: 0.3, sustain: 1, release: 1, useFilter: false, unisonVoices: 2, unisonDetune: 3
};
const PAD_SAW = {
  attack: 0.08, decay: 0.3, sustain: 1, release: 1, phaseOffset: 180, useFilter: true,
  filterMode: 0, filterCutoff: 5000, filterResonance: 0.7, unisonVoices: 2, unisonDetune: 3
};
// The low bed: a sound that repeats every 1.692 s, so its lines sit on a 0.591 Hz grid from
// 30 to 57 Hz, each two sines a few cents apart, one left, one right. It starts at 0:12.2.
const RUMBLE_SINE = {
  attack: 0.5, decay: 0.3, sustain: 1, release: 3, useFilter: false, unisonVoices: 2, unisonDetune: 4
};
// The bass line, the record's "booms": low notes struck with no swell at all, in the middle
// of the stereo picture (left/right correlation 0.92, where the pad's low notes are near 0),
// a fundamental and its octave (the second harmonic 7 dB down, the third 18 dB down): a sine
// FM'd at its own frequency. Every note's curve carries its own decay.
const BASS_FM = {
  attack: 0.004, decay: 0.3, sustain: 1, release: 0.15, useFM: true, fmRatio: 1, fmIndex: 0.75,
  useFilter: false, unisonVoices: 1
};

export const BRB_PARTS = {
  cs80: {
    layers: [
      { params: CS80_SINE, waveformType: 'sine', gain: 0.3646 },
      { params: CS80_SAW, waveformType: 'sawtooth', gain: 0.663 }
    ]
  },
  pad: {
    layers: [
      { params: PAD_SINE, waveformType: 'sine', gain: 0.3877 },
      { params: PAD_SAW, waveformType: 'sawtooth', gain: 0.4912 }
    ]
  },
  rumble: { layers: [{ params: RUMBLE_SINE, waveformType: 'sine', gain: 0.0665 }] },
  bass: { layers: [{ params: BASS_FM, waveformType: 'sine', gain: 0.7079 }] }
};

// The room every note brings: everything went through a Lexicon 224 at the mix, and the
// record's lead is as wet as it is direct (its harmonics' left/right coherence 0.3-0.5). Of
// the engine's rooms, the ambient one at full mix, decay and tone comes closest on the
// lead's own harmonics, the band-by-band width and how fast each band can fall; at size 0.8
// exactly, because other sizes turn the 63-125 Hz bands anti-phase.
export const BRB_FX = {
  reverbEnabled: true, reverbMode: 'ambient', reverbMix: 1, reverbSize: 0.8,
  reverbDecay: 1, reverbTone: 1, reverbPreDelay: 25, reverbWidth: 1,
  distortion: 0, delayEnabled: false
};

// The record's floor: under the music it never falls below a steady noise, measured as each
// frequency's quietest moments. Pink noise through one-pole low-passes at 1.4 and 4 kHz and a
// one-pole high-pass at 250 Hz has its slope from 250 Hz to 12 kHz. Under 100 Hz the floor is
// not the hiss (its quietest moments sit ~10 dB under the hiss's slope at 63-80 Hz, and a
// separate rumble fills 20-31 Hz), so the hiss is cut by a 2nd-order high-pass at 100 Hz and
// a subsonic noise (a 2nd-order low-pass at 40 Hz, RMS 0.13 of the hiss's) goes under it.
// It loops under the whole piece as its ambience bed, fading in over 3 s and out over the
// last 4.2 s with the record.
export const BRB_NOISE_GAIN = 0.0421;
const NOISE_SECONDS = 8;
const NOISE_CORNERS_HZ = [1400, 4000];
const NOISE_FLOOR_HZ = 250;
const NOISE_HISS_HP_HZ = 100;
const NOISE_SUB_LP_HZ = 40;
const NOISE_SUB_LEVEL = 0.13;
const NOISE_FADE_IN = 3;
const NOISE_FADE_OUT = 4.2;

/** A 2nd-order Butterworth (bilinear) over a loop, run twice so the kept pass starts in steady state. */
function butterworth(input, rate, corner, type) {
  const w = Math.tan(Math.PI * corner / rate);
  const k = 1 / (1 + Math.SQRT2 * w + w * w);
  const [b0, b1, b2] = type === 'highpass' ? [k, -2 * k, k] : [w * w * k, 2 * w * w * k, w * w * k];
  const a1 = 2 * (w * w - 1) * k;
  const a2 = (1 - Math.SQRT2 * w + w * w) * k;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      if (pass === 1) out[i] = y;
    }
  }
  return out;
}

const rms = (data) => Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);

/** Eight seconds of the record's floor noise, seamless when looped. */
export function makeRecordNoise(context, random = Math.random) {
  const rate = context.sampleRate;
  const length = Math.round(NOISE_SECONDS * rate);
  const fade = Math.round(0.25 * rate);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const raw = new Float32Array(length + fade);
  // Paul Kellet's economy pinking filter, then the low-passes and the high-pass.
  let b0 = 0, b1 = 0, b2 = 0, bass = 0;
  const lows = NOISE_CORNERS_HZ.map((hz) => ({ pole: Math.exp(-2 * Math.PI * hz / rate), y: 0 }));
  const bassPole = Math.exp(-2 * Math.PI * NOISE_FLOOR_HZ / rate);
  for (let i = 0; i < raw.length; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    let x = b0 + b1 + b2 + white * 0.1848;
    for (const low of lows) x = low.y = low.pole * low.y + (1 - low.pole) * x;
    bass = bassPole * bass + (1 - bassPole) * x;
    raw[i] = x - bass;
  }
  // The tail crossfades into the head, so the loop has no seam.
  const looped = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    looped[i] = i < fade ? raw[i] * (i / fade) + raw[length + i] * (1 - i / fade) : raw[i];
  }
  const hiss = butterworth(looped, rate, NOISE_HISS_HP_HZ, 'highpass');
  const sub = butterworth(Float32Array.from({ length }, () => random() * 2 - 1), rate, NOISE_SUB_LP_HZ, 'lowpass');
  const subScale = NOISE_SUB_LEVEL * rms(hiss) / rms(sub);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    data[i] = hiss[i] + sub[i] * subScale;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < length; i++) data[i] /= peak;
  return buffer;
}

/** RPN 0 (pitch bend range) of a channel's track, in cents per full bend. */
function bendRangeCents(track) {
  const events = [101, 100, 6]
    .flatMap((number) => (track.controlChanges[number] || []).map((event) => ({ number, event })))
    .sort((a, b) => a.event.ticks - b.event.ticks);
  let msb = null;
  let lsb = null;
  let semitones = 2;
  for (const { number, event } of events) {
    const value = Math.round(event.value * 127);
    if (number === 101) msb = value;
    else if (number === 100) lsb = value;
    else if (msb === 0 && lsb === 0) semitones = value;
  }
  return semitones * 100;
}

/**
 * A channel's controller as a curve sampled at `rate` from `from` for `seconds`: straight
 * lines between its events (they are a simplified curve's vertices), flat before the first
 * and after the last.
 */
function sampleCurve(points, from, seconds, rate) {
  const count = Math.max(1, Math.ceil(seconds * rate) + 1);
  const out = new Float32Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const time = from + i / rate;
    while (j + 1 < points.length && points[j + 1].time <= time) j += 1;
    const a = points[j];
    const b = points[j + 1];
    out[i] = !b || time <= a.time ? a.value : a.value + (b.value - a.value) * (time - a.time) / (b.time - a.time);
  }
  return out;
}

/** The performance in a Blade Runner Blues MIDI file (a @tonejs/midi Midi): notes with part and expression. */
export function readBladeRunnerBlues(midi) {
  const notes = midi.tracks.flatMap((track) => {
    const part = partOfChannel(track.channel);
    if (!part || !track.notes.length) return [];
    const range = bendRangeCents(track);
    // @tonejs/midi hands pitch bends over as -1..1 of the full bend
    const bends = track.pitchBends.map((bend) => ({ time: bend.time, value: bend.value * range }));
    const levels = (track.controlChanges[11] || [])
      .map((event) => ({ time: event.time, value: 10 ** ((event.value * 127 - 127) / 40) }));
    return track.notes.map((note) => {
      const rate = Math.min(BRB_EXPRESSION_RATE, MAX_CURVE_POINTS / Math.max(1, note.duration));
      const curve = (points) => (points.length ? sampleCurve(points, note.time, note.duration, rate) : undefined);
      return {
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        part,
        expression: { rate, pitch: curve(bends), gain: curve(levels) },
        audioParamOverrides: BRB_FX
      };
    });
  }).sort((a, b) => a.time - b.time || a.midi - b.midi);
  return { name: midi.name, duration: midi.duration, parts: BRB_PARTS, notes };
}

/** The score with the record's floor noise under it (`noise`, a buffer from makeRecordNoise). */
export function arrangeBladeRunnerBlues(score, noise = null) {
  return noise
    ? {
      ...score,
      ambience: {
        buffer: noise, gain: BRB_NOISE_GAIN, audioParamOverrides: BRB_FX, fadeIn: NOISE_FADE_IN, fadeOut: NOISE_FADE_OUT
      }
    }
    : score;
}

export async function loadBladeRunnerBlues(context, path) {
  const [{ Midi }, response] = await Promise.all([import('@tonejs/midi'), fetch(path)]);
  if (!response.ok) throw new Error(`Blade Runner Blues: HTTP ${response.status}`);
  return arrangeBladeRunnerBlues(readBladeRunnerBlues(new Midi(await response.arrayBuffer())), makeRecordNoise(context));
}
