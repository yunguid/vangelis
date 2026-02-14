/**
 * Built-in sound set manifest.
 * NOTE: samplePath values are relative to /public/samples.
 */

export const SOUNDSET_MANIFEST = {
  'rachmaninoff-orchestral-lite': {
    id: 'rachmaninoff-orchestral-lite',
    name: 'Rachmaninoff Concerto No. 2 (Starter Pack)',
    quality: {
      sampleRate: 48000,
      bitDepth: 24
    },
    layerFamilies: ['piano', 'strings'],
    instruments: [
      {
        id: 'piano',
        label: 'Upright Piano',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C4_mf_RR1.wav',
        baseNote: 'C4'
      },
      {
        id: 'violin',
        label: 'Violin Section',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_G4_v1.wav',
        baseNote: 'G4',
        minMidi: 60
      },
      {
        id: 'cello',
        label: 'Cello Section',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C3_v1_1.wav',
        baseNote: 'C3',
        maxMidi: 59
      }
    ]
  },
  'cinematic-starter-pack': {
    id: 'cinematic-starter-pack',
    name: 'Cinematic Starter Pack',
    quality: {
      sampleRate: 48000,
      bitDepth: 24
    },
    layerFamilies: ['piano', 'strings', 'brass'],
    instruments: [
      {
        id: 'grand-piano',
        label: 'Upright Piano',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C4_mf_RR1.wav',
        baseNote: 'C4'
      },
      {
        id: 'viola-ensemble',
        label: 'Viola Ensemble',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_C4_v1_1.wav',
        baseNote: 'C4'
      },
      {
        id: 'french-horn',
        label: 'French Horn',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_F2_v1_1.wav',
        baseNote: 'F2'
      }
    ]
  }
};

export const getSoundSetManifest = (id) => SOUNDSET_MANIFEST[id] || null;
export const getAllSoundSetManifests = () => Object.values(SOUNDSET_MANIFEST);
