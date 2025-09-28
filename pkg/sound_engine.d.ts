/* tslint:disable */
/* eslint-disable */
export function wasm_generate_waveform(waveform: WasmWaveform, freq: number, duration_secs: number, sample_rate: number): Float32Array;
export function wasm_generate_waveform_with_phase(waveform: WasmWaveform, freq: number, phase_offset: number, duration_secs: number, sample_rate: number): Float32Array;
export function wasm_parallel_generate_waveform(waveform: WasmWaveform, freq: number, duration_secs: number, sample_rate: number): Float32Array;
export function wasm_fm_waveform(carrier_freq: number, modulator_freq: number, modulation_index: number, duration_secs: number, sample_rate: number): Float32Array;
export function wasm_fm_waveform_parallel(carrier_freq: number, modulator_freq: number, modulation_index: number, duration_secs: number, sample_rate: number): Float32Array;
export function wasm_apply_adsr(samples: Float32Array, attack: number, decay: number, sustain: number, release: number, sample_rate: number): void;
export function wasm_pan_stereo(samples: Float32Array, pan: number): Float32Array;
export enum WasmWaveform {
  Sine = 0,
  Sawtooth = 1,
  Square = 2,
  Triangle = 3,
}
export class ADSR {
  free(): void;
  constructor(attack: number, decay: number, sustain: number, release: number);
  static default(): ADSR;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}
export class DSPChain {
  free(): void;
  constructor();
  process(samples: Float32Array, sample_rate: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_adsr_free: (a: number, b: number) => void;
  readonly __wbg_get_adsr_attack: (a: number) => number;
  readonly __wbg_set_adsr_attack: (a: number, b: number) => void;
  readonly __wbg_get_adsr_decay: (a: number) => number;
  readonly __wbg_set_adsr_decay: (a: number, b: number) => void;
  readonly __wbg_get_adsr_sustain: (a: number) => number;
  readonly __wbg_set_adsr_sustain: (a: number, b: number) => void;
  readonly __wbg_get_adsr_release: (a: number) => number;
  readonly __wbg_set_adsr_release: (a: number, b: number) => void;
  readonly adsr_new: (a: number, b: number, c: number, d: number) => number;
  readonly adsr_default: () => number;
  readonly __wbg_dspchain_free: (a: number, b: number) => void;
  readonly dspchain_new: () => number;
  readonly dspchain_process: (a: number, b: number, c: number, d: any, e: number) => void;
  readonly wasm_generate_waveform: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasm_generate_waveform_with_phase: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wasm_parallel_generate_waveform: (a: number, b: number, c: number, d: number) => [number, number];
  readonly wasm_fm_waveform: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wasm_fm_waveform_parallel: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wasm_apply_adsr: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number) => void;
  readonly wasm_pan_stereo: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
