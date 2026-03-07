/**
 * Built-in sound set manifest.
 * NOTE: samplePath values are relative to /public/samples.
 */

export const SOUNDSET_MANIFEST = {
  'rachmaninoff-orchestral-lite': {
    id: 'rachmaninoff-orchestral-lite',
    name: 'Romantic Grand and Velvet Strings',
    quality: {
      sampleRate: 48000,
      bitDepth: 24
    },
    layerFamilies: ['piano', 'strings', 'ensemble'],
    instruments: [
      {
        id: 'grand-foundation',
        label: 'Concert Grand Foundation',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C2_mf_RR1.wav',
        baseNote: 'C2',
        maxMidi: 45
      },
      {
        id: 'grand-body',
        label: 'Concert Grand Body',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C4_mf_RR1.wav',
        baseNote: 'C4',
        minMidi: 46,
        maxMidi: 68
      },
      {
        id: 'grand-presence',
        label: 'Concert Grand Presence',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C5_mf_RR1.wav',
        baseNote: 'C5',
        minMidi: 69,
        maxMidi: 84
      },
      {
        id: 'grand-air',
        label: 'Concert Grand Air',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C6_pp_RR1.wav',
        baseNote: 'C6',
        minMidi: 85
      },
      {
        id: 'contrabass-floor',
        label: 'Contrabass Floor',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/contrabass/BKCtbss_SusVib_G0_v1_rr1.wav',
        baseNote: 'G0',
        maxMidi: 40
      },
      {
        id: 'cello-bloom',
        label: 'Cello Bloom',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 36,
        maxMidi: 60
      },
      {
        id: 'violin-sheen',
        label: 'Violin Sheen',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_C4_v1.wav',
        baseNote: 'C4',
        minMidi: 61
      }
    ]
  },
  'cinematic-starter-pack': {
    id: 'cinematic-starter-pack',
    name: 'Cinematic Chamber Bloom',
    quality: {
      sampleRate: 48000,
      bitDepth: 24
    },
    layerFamilies: ['piano', 'strings', 'brass'],
    instruments: [
      {
        id: 'piano-shadow',
        label: 'Piano Shadow',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C2_pp_RR1.wav',
        baseNote: 'C2',
        maxMidi: 50
      },
      {
        id: 'piano-crown',
        label: 'Piano Crown',
        families: ['piano'],
        samplePath: 'starter-pack/piano/UR1_C5_mf_RR1.wav',
        baseNote: 'C5',
        minMidi: 51
      },
      {
        id: 'cello-foundation',
        label: 'Cello Foundation',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C1_v1_1.wav',
        baseNote: 'C1',
        maxMidi: 55
      },
      {
        id: 'viola-veil',
        label: 'Viola Veil',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_C4_v1_1.wav',
        baseNote: 'C4',
        minMidi: 56,
        maxMidi: 67
      },
      {
        id: 'violin-halo',
        label: 'Violin Halo',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_G4_v1.wav',
        baseNote: 'G4',
        minMidi: 68
      },
      {
        id: 'horn-round',
        label: 'French Horn Round',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_C1_v1_1.wav',
        baseNote: 'C1',
        maxMidi: 59
      },
      {
        id: 'horn-burnished',
        label: 'French Horn Burnished',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 60,
        maxMidi: 74
      },
      {
        id: 'trumpet-lift',
        label: 'Trumpet Lift',
        families: ['brass'],
        samplePath: 'starter-pack/brass/trumpet/Sum_SHTrumpet_sus_C5_v1_rr1.wav',
        baseNote: 'C5',
        minMidi: 75
      }
    ]
  },
  'orchestral-extended-starter': {
    id: 'orchestral-extended-starter',
    name: 'Imperial Orchestra Starter',
    quality: {
      sampleRate: 44100,
      bitDepth: 24
    },
    layerFamilies: ['strings', 'brass', 'reed', 'piano'],
    instruments: [
      {
        id: 'contrabass-foundation',
        label: 'Contrabass Foundation',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/contrabass/BKCtbss_SusVib_G0_v1_rr1.wav',
        baseNote: 'G0',
        maxMidi: 39
      },
      {
        id: 'cello-body',
        label: 'Cello Body',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/cello/susvib_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 40,
        maxMidi: 55
      },
      {
        id: 'viola-core',
        label: 'Viola Core',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/viola/ViolaEns_susvib_C4_v1_1.wav',
        baseNote: 'C4',
        minMidi: 56,
        maxMidi: 67
      },
      {
        id: 'violin-crown',
        label: 'Violin Crown',
        families: ['strings', 'ensemble'],
        samplePath: 'starter-pack/strings/violin/VlnEns_susVib_D5_v1.wav',
        baseNote: 'D5',
        minMidi: 68
      },
      {
        id: 'bassoon-grain',
        label: 'Bassoon Grain',
        families: ['reed'],
        samplePath: 'starter-pack/woodwinds/bassoon/PSBassoon_C2_v1_1.wav',
        baseNote: 'C2',
        maxMidi: 57
      },
      {
        id: 'clarinet-bridge',
        label: 'Clarinet Bridge',
        families: ['reed'],
        samplePath: 'starter-pack/woodwinds/clarinet/DCClar_susLong_D3_v1_rr1_sum.wav',
        baseNote: 'D3',
        minMidi: 58,
        maxMidi: 76
      },
      {
        id: 'clarinet-crown',
        label: 'Clarinet Crown',
        families: ['reed'],
        samplePath: 'starter-pack/woodwinds/clarinet/DCClar_susLong_F#5_v1_rr1_sum.wav',
        baseNote: 'F#5',
        minMidi: 77
      },
      {
        id: 'horn-bronze',
        label: 'Horn Bronze',
        families: ['brass'],
        samplePath: 'starter-pack/brass/horn/MOHorn_sus_F2_v1_1.wav',
        baseNote: 'F2',
        maxMidi: 60
      },
      {
        id: 'trombone-stride',
        label: 'Trombone Stride',
        families: ['brass'],
        samplePath: 'starter-pack/brass/trombone/tenortbn_sus_C3_v1_1.wav',
        baseNote: 'C3',
        minMidi: 61,
        maxMidi: 71
      },
      {
        id: 'trumpet-flare',
        label: 'Trumpet Flare',
        families: ['brass'],
        samplePath: 'starter-pack/brass/trumpet/Sum_SHTrumpet_sus_C5_v1_rr1.wav',
        baseNote: 'C5',
        minMidi: 72
      },
      {
        id: 'harp-lustre',
        label: 'Harp Lustre',
        families: ['piano', 'chromatic percussion'],
        samplePath: 'starter-pack/strings/harp/KSHarp_C5_mf.wav',
        baseNote: 'C5',
        minMidi: 65
      }
    ]
  }
};

export const getSoundSetManifest = (id) => SOUNDSET_MANIFEST[id] || null;
export const getAllSoundSetManifests = () => Object.values(SOUNDSET_MANIFEST);
