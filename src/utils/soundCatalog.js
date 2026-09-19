import { SAMPLED_INSTRUMENTS } from '../data/sampledInstruments.js';
import { loadUserPresets } from './userPresetStorage.js';

const WAVEFORMS = ['Sine', 'Sawtooth', 'Square', 'Triangle'];

/**
 * Every sound the player can load, in browsing order: the recorded
 * instruments, the bare waveforms, the factory bank and Patch Lab by category,
 * then the player's own saved sounds. The preset banks are imported here so
 * they stay out of every route's first load. A waveform entry has no
 * audioParams: it changes the oscillator only. An instrument entry carries
 * `instrument`: its notes are recordings, not the synth.
 */
export async function loadSoundCatalog() {
  const [factory, lab] = await Promise.all([
    import('./factoryPresets.js'),
    import('./patchLabPresets.js')
  ]);
  return [
    ...SAMPLED_INSTRUMENTS,
    ...WAVEFORMS.map((waveformType) => ({
      id: `waveform-${waveformType.toLowerCase()}`,
      name: waveformType,
      category: 'Waveforms',
      waveformType,
      audioParams: null
    })),
    ...factory.FACTORY_PRESETS,
    ...lab.PATCH_LAB_PRESETS,
    ...loadUserPresets().map((preset) => ({ ...preset, category: 'Your sounds', removable: true }))
  ];
}
