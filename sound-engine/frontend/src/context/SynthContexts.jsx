import { createContext, useContext } from 'react';

/**
 * Focused app contexts. Each groups one concern that used to be drilled
 * through the Sidebar as individual props.
 */

/** Sound design state: waveform, params, control sections, transport tempo */
export const SoundControlsContext = createContext(null);

/** MIDI transport: play/pause/stop/tempo + playback state */
export const MidiTransportContext = createContext(null);

/** Voice phrase state + handlers */
export const VoicePhraseContext = createContext(null);

const EMPTY = Object.freeze({});

// Tolerant accessors: pages that render a disabled Sidebar rail (e.g. the
// lab pages) have no providers; they get an empty object, matching the old
// undefined-prop behavior.
export const useSoundControls = () => useContext(SoundControlsContext) || EMPTY;
export const useMidiTransport = () => useContext(MidiTransportContext) || EMPTY;
export const useVoicePhrase = () => useContext(VoicePhraseContext) || EMPTY;
