let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
/**
 * @param {WasmWaveform} waveform
 * @param {number} freq
 * @param {number} duration_secs
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function wasm_generate_waveform(waveform, freq, duration_secs, sample_rate) {
    const ret = wasm.wasm_generate_waveform(waveform, freq, duration_secs, sample_rate);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {WasmWaveform} waveform
 * @param {number} freq
 * @param {number} phase_offset
 * @param {number} duration_secs
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function wasm_generate_waveform_with_phase(waveform, freq, phase_offset, duration_secs, sample_rate) {
    const ret = wasm.wasm_generate_waveform_with_phase(waveform, freq, phase_offset, duration_secs, sample_rate);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {WasmWaveform} waveform
 * @param {number} freq
 * @param {number} duration_secs
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function wasm_parallel_generate_waveform(waveform, freq, duration_secs, sample_rate) {
    const ret = wasm.wasm_parallel_generate_waveform(waveform, freq, duration_secs, sample_rate);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {number} carrier_freq
 * @param {number} modulator_freq
 * @param {number} modulation_index
 * @param {number} duration_secs
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function wasm_fm_waveform(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate) {
    const ret = wasm.wasm_fm_waveform(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {number} carrier_freq
 * @param {number} modulator_freq
 * @param {number} modulation_index
 * @param {number} duration_secs
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function wasm_fm_waveform_parallel(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate) {
    const ret = wasm.wasm_fm_waveform_parallel(carrier_freq, modulator_freq, modulation_index, duration_secs, sample_rate);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * @param {Float32Array} samples
 * @param {number} attack
 * @param {number} decay
 * @param {number} sustain
 * @param {number} release
 * @param {number} sample_rate
 */
export function wasm_apply_adsr(samples, attack, decay, sustain, release, sample_rate) {
    var ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.wasm_apply_adsr(ptr0, len0, samples, attack, decay, sustain, release, sample_rate);
}

/**
 * @param {Float32Array} samples
 * @param {number} pan
 * @returns {Float32Array}
 */
export function wasm_pan_stereo(samples, pan) {
    const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_pan_stereo(ptr0, len0, pan);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * @enum {0 | 1 | 2 | 3}
 */
export const WasmWaveform = Object.freeze({
    Sine: 0, "0": "Sine",
    Sawtooth: 1, "1": "Sawtooth",
    Square: 2, "2": "Square",
    Triangle: 3, "3": "Triangle",
});

const ADSRFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_adsr_free(ptr >>> 0, 1));

export class ADSR {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ADSR.prototype);
        obj.__wbg_ptr = ptr;
        ADSRFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ADSRFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_adsr_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get attack() {
        const ret = wasm.__wbg_get_adsr_attack(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set attack(arg0) {
        wasm.__wbg_set_adsr_attack(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get decay() {
        const ret = wasm.__wbg_get_adsr_decay(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set decay(arg0) {
        wasm.__wbg_set_adsr_decay(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get sustain() {
        const ret = wasm.__wbg_get_adsr_sustain(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set sustain(arg0) {
        wasm.__wbg_set_adsr_sustain(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get release() {
        const ret = wasm.__wbg_get_adsr_release(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set release(arg0) {
        wasm.__wbg_set_adsr_release(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} attack
     * @param {number} decay
     * @param {number} sustain
     * @param {number} release
     */
    constructor(attack, decay, sustain, release) {
        const ret = wasm.adsr_new(attack, decay, sustain, release);
        this.__wbg_ptr = ret >>> 0;
        ADSRFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {ADSR}
     */
    static default() {
        const ret = wasm.adsr_default();
        return ADSR.__wrap(ret);
    }
}

const DSPChainFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_dspchain_free(ptr >>> 0, 1));

export class DSPChain {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DSPChainFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_dspchain_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.dspchain_new();
        this.__wbg_ptr = ret >>> 0;
        DSPChainFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array} samples
     * @param {number} sample_rate
     */
    process(samples, sample_rate) {
        var ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.dspchain_process(this.__wbg_ptr, ptr0, len0, samples, sample_rate);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
        new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_3;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('sound_engine_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
