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
        id: 'piano-low',
        label: 'Upright Piano Low',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C2_mf_RR1.wav',
        baseNote: 'C2',
        maxMidi: 53
      },
      {
        id: 'piano-mid',
        label: 'Upright Piano Mid',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C4_mf_RR1.wav',
        baseNote: 'C4',
        minMidi: 54,
        maxMidi: 77
      },
      {
        id: 'piano-high',
        label: 'Upright Piano High',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C6_mf_RR1.wav',
        baseNote: 'C6',
        minMidi: 78
      },
      {
        id: 'violin-low',
        label: 'Violin Section Low',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_A2_v1.wav',
        baseNote: 'A2',
        minMidi: 62,
        maxMidi: 70
      },
      {
        id: 'violin-mid',
        label: 'Violin Section Mid',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_C4_v1.wav',
        baseNote: 'C4',
        minMidi: 71,
        maxMidi: 79
      },
      {
        id: 'violin-high',
        label: 'Violin Section High',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_G4_v1.wav',
        baseNote: 'G4',
        minMidi: 80
      },
      {
        id: 'cello-low',
        label: 'Cello Section Low',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C1_v1_1.wav',
        baseNote: 'C1',
        maxMidi: 48
      },
      {
        id: 'cello-mid',
        label: 'Cello Section Mid',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 49,
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
        id: 'grand-piano-low',
        label: 'Upright Piano Low',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C2_mf_RR1.wav',
        baseNote: 'C2',
        maxMidi: 57
      },
      {
        id: 'grand-piano-high',
        label: 'Upright Piano High',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C5_mf_RR1.wav',
        baseNote: 'C5',
        minMidi: 58
      },
      {
        id: 'viola-low',
        label: 'Viola Ensemble Low',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_C2_v1_1.wav',
        baseNote: 'C2',
        maxMidi: 66
      },
      {
        id: 'viola-mid',
        label: 'Viola Ensemble Mid',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_C4_v1_1.wav',
        baseNote: 'C4',
        minMidi: 67,
        maxMidi: 76
      },
      {
        id: 'viola-high',
        label: 'Viola Ensemble High',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_G4_v1_1.wav',
        baseNote: 'G4',
        minMidi: 77
      },
      {
        id: 'french-horn-low',
        label: 'French Horn Low',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_C1_v1_1.wav',
        baseNote: 'C1',
        maxMidi: 56
      },
      {
        id: 'french-horn-mid',
        label: 'French Horn Mid',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_F2_v1_1.wav',
        baseNote: 'F2',
        minMidi: 57,
        maxMidi: 68
      },
      {
        id: 'french-horn-high',
        label: 'French Horn High',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 69
      }
    ]
  }
};

export const getSoundSetManifest = (id) => SOUNDSET_MANIFEST[id] || null;
export const getAllSoundSetManifests = () => Object.values(SOUNDSET_MANIFEST);
