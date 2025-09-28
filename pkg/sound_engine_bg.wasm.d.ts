/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_adsr_free: (a: number, b: number) => void;
export const __wbg_get_adsr_attack: (a: number) => number;
export const __wbg_set_adsr_attack: (a: number, b: number) => void;
export const __wbg_get_adsr_decay: (a: number) => number;
export const __wbg_set_adsr_decay: (a: number, b: number) => void;
export const __wbg_get_adsr_sustain: (a: number) => number;
export const __wbg_set_adsr_sustain: (a: number, b: number) => void;
export const __wbg_get_adsr_release: (a: number) => number;
export const __wbg_set_adsr_release: (a: number, b: number) => void;
export const adsr_new: (a: number, b: number, c: number, d: number) => number;
export const adsr_default: () => number;
export const __wbg_dspchain_free: (a: number, b: number) => void;
export const dspchain_new: () => number;
export const dspchain_process: (a: number, b: number, c: number, d: any, e: number) => void;
export const wasm_generate_waveform: (a: number, b: number, c: number, d: number) => [number, number];
export const wasm_generate_waveform_with_phase: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const wasm_parallel_generate_waveform: (a: number, b: number, c: number, d: number) => [number, number];
export const wasm_fm_waveform: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const wasm_fm_waveform_parallel: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const wasm_apply_adsr: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number) => void;
export const wasm_pan_stereo: (a: number, b: number, c: number) => [number, number];
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_export_3: WebAssembly.Table;
export const __wbindgen_start: () => void;
