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
 * 13-14 and the low bed's on 15 (voices of those two share a channel, so a standard player
 * hears their curves as one).
 */

// Curves are handed to the synth at this rate (points per second of a note), fewer for
// notes so long that a curve would pass MAX_CURVE_POINTS (the low bed holds for minutes).
export const BRB_EXPRESSION_RATE = 100;
const MAX_CURVE_POINTS = 12000;

const partOfChannel = (channel) => (channel < 12 ? 'cs80' : channel < 14 ? 'pad' : channel === 14 ? 'rumble' : null);

// The CS-80's two channels per key, as the record's lead measures (the median of 57 notes
// from E4 to D5): its harmonics run clean to 16 kHz, falling like a sawtooth's but 7 dB
// under a fundamental that stands out - a sine straight to the amplifier (the CS-80's
// sine lever) beside a sawtooth at 0.87 of its fundamental, through a low-pass near
// 8 kHz with a little resonance. The saw starts half a cycle on, so its fundamental adds
// to the sine's (a rising ramp's fundamental is the sine's upside down). Swells, scoops
// and vibrato are each note's own curves; the envelopes only open and close them.
const CS80_SINE = {
  attack: 0.005, decay: 0.2, sustain: 1, release: 0.9, useFilter: false, unisonVoices: 1
};
const CS80_SAW = {
  attack: 0.005, decay: 0.2, sustain: 1, release: 0.9, phaseOffset: 180, useFilter: true,
  filterMode: 0, filterCutoff: 8000, filterResonance: 1.2, unisonVoices: 1
};
// The pad under it, as one template fitted to all of its notes: a fundamental, the
// second harmonic 7 dB down, the third 29 dB down - a sine frequency-modulated at the
// same frequency with an index of 0.75 has that spectrum. Each note carries the record's
// swell as its loudness curve.
const PAD_FM = {
  attack: 0.08, decay: 0.3, sustain: 1, release: 1, useFM: true, fmRatio: 1, fmIndex: 0.75,
  useFilter: false, unisonVoices: 2, unisonDetune: 3
};
// The low bed: steady tones between 30 and 52 Hz, as wide as they are deep (the record's
// bed is as strong in its sides as in its middle), so each is two sines a few cents
// apart, one left, one right.
const RUMBLE_SINE = {
  attack: 2, decay: 0.3, sustain: 1, release: 3, useFilter: false, unisonVoices: 2, unisonDetune: 4
};

export const BRB_PARTS = {
  cs80: {
    layers: [
      { params: CS80_SINE, waveformType: 'sine', gain: 0.56 },
      { params: CS80_SAW, waveformType: 'sawtooth', gain: 0.77 }
    ]
  },
  pad: { layers: [{ params: PAD_FM, waveformType: 'sine', gain: 1.66 }] },
  rumble: { layers: [{ params: RUMBLE_SINE, waveformType: 'sine', gain: 0.067 }] }
};

// The room every note brings: everything went through a Lexicon 224 at the mix. The
// wettest, longest hall tried scored closest to the record (renders of 0:10-1:00).
export const BRB_FX = {
  reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.85, reverbSize: 1,
  reverbDecay: 0.97, reverbTone: 0.5, reverbPreDelay: 25, reverbWidth: 1,
  distortion: 0, delayEnabled: false
};

// The record's floor: under the music it never falls below a steady noise, about level from
// 100 to 400 Hz and falling ~9 dB an octave above (measured as each frequency's quietest
// moments). Pink noise (-3 dB an octave) through a one-pole low-pass at 400 Hz (-6 more)
// and a one-pole high-pass at 250 Hz (which levels the bottom) has that shape; it loops
// under the whole piece as its ambience bed.
export const BRB_NOISE_GAIN = 0.053;
const NOISE_SECONDS = 8;
const NOISE_CORNER_HZ = 400;
const NOISE_FLOOR_HZ = 250;

/** Eight seconds of the record's floor noise, seamless when looped. */
export function makeRecordNoise(context, random = Math.random) {
  const rate = context.sampleRate;
  const length = Math.round(NOISE_SECONDS * rate);
  const fade = Math.round(0.25 * rate);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const raw = new Float32Array(length + fade);
  // Paul Kellet's economy pinking filter, then the low-pass and the high-pass.
  let b0 = 0, b1 = 0, b2 = 0, low = 0, bass = 0;
  const pole = Math.exp(-2 * Math.PI * NOISE_CORNER_HZ / rate);
  const bassPole = Math.exp(-2 * Math.PI * NOISE_FLOOR_HZ / rate);
  for (let i = 0; i < raw.length; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = b0 + b1 + b2 + white * 0.1848;
    low = pole * low + (1 - pole) * pink;
    bass = bassPole * bass + (1 - bassPole) * low;
    raw[i] = low - bass;
  }
  // The tail crossfades into the head, so the loop has no seam.
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const x = i < fade ? raw[i] * (i / fade) + raw[length + i] * (1 - i / fade) : raw[i];
    data[i] = x;
    peak = Math.max(peak, Math.abs(x));
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
  return noise ? { ...score, ambience: { buffer: noise, gain: BRB_NOISE_GAIN, audioParamOverrides: BRB_FX } } : score;
}

export async function loadBladeRunnerBlues(context, path) {
  const [{ Midi }, response] = await Promise.all([import('@tonejs/midi'), fetch(path)]);
  if (!response.ok) throw new Error(`Blade Runner Blues: HTTP ${response.status}`);
  return arrangeBladeRunnerBlues(readBladeRunnerBlues(new Midi(await response.arrayBuffer())), makeRecordNoise(context));
}
