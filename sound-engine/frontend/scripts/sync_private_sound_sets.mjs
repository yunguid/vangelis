import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(frontendRoot, 'public');
const privateSamplesRoot = path.join(publicRoot, 'samples', 'private-library', 'ableton-grand-piano');
const privateManifestPath = path.join(publicRoot, 'private-sound-sets.json');
const abletonGrandPianoRoot = '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Grand Piano';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const quiet = args.has('--quiet');

const sampleSpecs = [
  {
    id: 'grand-piano-c1-mf',
    baseNote: 'C1',
    sourceFile: 'GrandPiano C1 mf.aif',
    outputFile: 'grand-piano-c1-mf.wav'
  },
  {
    id: 'grand-piano-c2-p',
    baseNote: 'C2',
    sourceFile: 'GrandPiano C2 p.aif',
    outputFile: 'grand-piano-c2-p.wav'
  },
  {
    id: 'grand-piano-c4-mf',
    baseNote: 'C4',
    sourceFile: 'GrandPiano C4 mf.aif',
    outputFile: 'grand-piano-c4-mf.wav'
  },
  {
    id: 'grand-piano-c5-mf',
    baseNote: 'C5',
    sourceFile: 'GrandPiano C5 mf.aif',
    outputFile: 'grand-piano-c5-mf.wav'
  },
  {
    id: 'grand-piano-c5-f',
    baseNote: 'C5',
    sourceFile: 'GrandPiano C5 f.aif',
    outputFile: 'grand-piano-c5-f.wav'
  },
  {
    id: 'grand-piano-b6-p',
    baseNote: 'B6',
    sourceFile: 'GrandPiano B6 p.aif',
    outputFile: 'grand-piano-b6-p.wav'
  },
  {
    id: 'upright-home-c4',
    baseNote: 'C4',
    sourceFile: 'Upright Home Piano C4.aif',
    outputFile: 'upright-home-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Upright Home Piano'
  },
  {
    id: 'mamas-bass-c1',
    baseNote: 'C1',
    sourceFile: 'Mamas Bass - C1.aif',
    outputFile: 'mamas-bass-c1.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Mamas Bass'
  },
  {
    id: 'ambient-encounters-c4',
    baseNote: 'C4',
    sourceFile: 'Ambient Encounters - C4.aif',
    outputFile: 'ambient-encounters-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Ambient Encounters'
  },
  {
    id: 'phantasm-c4',
    baseNote: 'C4',
    sourceFile: 'Phantasm - C4.aif',
    outputFile: 'phantasm-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Phantasm'
  },
  {
    id: 'ikembe-c2',
    baseNote: 'C2',
    sourceFile: 'Ikembe C2.aif',
    outputFile: 'ikembe-c2.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Ikembe'
  },
  {
    id: 'arco-metal-fsharp5',
    baseNote: 'F#5',
    sourceFile: 'Arco Metal Attack Medium F#5 1.aif',
    outputFile: 'arco-metal-fsharp5.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Sound Objects/Arco Metal Attack Medium'
  },
  {
    id: 'dark-thought-c4',
    baseNote: 'C4',
    sourceFile: 'Dark Thought - C4.aif',
    outputFile: 'dark-thought-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Dark Thought'
  },
  {
    id: 'galactica-c4',
    baseNote: 'C4',
    sourceFile: 'Galactica - C4 - 1.aif',
    outputFile: 'galactica-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Galactica'
  },
  {
    id: 'smooth-synth-c4',
    baseNote: 'C4',
    sourceFile: 'Smooth Synth - C4 - 1.aif',
    outputFile: 'smooth-synth-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Smooth Synth'
  },
  {
    id: 'saw-percussion-c4',
    baseNote: 'C4',
    sourceFile: 'Saw-C4.aif',
    outputFile: 'saw-percussion-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Saw Percussion'
  },
  {
    id: 'arp-poly-lead-c4',
    baseNote: 'C4',
    sourceFile: 'ARP Poly Lead - C4.aif',
    outputFile: 'arp-poly-lead-c4.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/ARP Poly Lead'
  },
  {
    id: 'pulse-bass-c2',
    baseNote: 'C2',
    sourceFile: 'Pulse Bass - C2.aif',
    outputFile: 'pulse-bass-c2.wav',
    sourceRoot: '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core Library/Samples/Multisamples/Synths/Pulse Bass'
  }
];

const samplePathsById = Object.fromEntries(sampleSpecs.map((sample) => ([
  sample.id,
  `private-library/ableton-grand-piano/${sample.outputFile}`
])));

const soundSetOverrides = [
  {
    id: 'rachmaninoff-orchestral-lite',
    quality: {
      sampleRate: 44100,
      bitDepth: 16
    },
    instruments: [
      {
        id: 'grand-foundation',
        samplePath: samplePathsById['grand-piano-c1-mf'],
        baseNote: 'C1',
        maxMidi: 45
      },
      {
        id: 'grand-body',
        samplePath: samplePathsById['grand-piano-c4-mf'],
        baseNote: 'C4',
        minMidi: 46,
        maxMidi: 68
      },
      {
        id: 'grand-presence',
        samplePath: samplePathsById['grand-piano-c5-f'],
        baseNote: 'C5',
        minMidi: 69,
        maxMidi: 84
      },
      {
        id: 'grand-air',
        samplePath: samplePathsById['grand-piano-b6-p'],
        baseNote: 'B6',
        minMidi: 85
      }
    ]
  },
  {
    id: 'cinematic-starter-pack',
    quality: {
      sampleRate: 44100,
      bitDepth: 16
    },
    instruments: [
      {
        id: 'piano-shadow',
        samplePath: samplePathsById['grand-piano-c2-p'],
        baseNote: 'C2',
        maxMidi: 50
      },
      {
        id: 'piano-crown',
        samplePath: samplePathsById['grand-piano-c5-mf'],
        baseNote: 'C5',
        minMidi: 51
      }
    ]
  },
  {
    id: 'ableton-private-starter',
    name: 'Ableton Private Favorites',
    quality: {
      sampleRate: 44100,
      bitDepth: 16
    },
    layerFamilies: ['piano', 'bass', 'synth', 'chromatic percussion', 'texture'],
    instruments: [
      {
        id: 'ableton-upright-home',
        label: 'Ableton Upright Home',
        families: ['piano'],
        samplePath: samplePathsById['upright-home-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-mamas-bass',
        label: 'Ableton Mamas Bass',
        families: ['bass'],
        samplePath: samplePathsById['mamas-bass-c1'],
        baseNote: 'C1'
      },
      {
        id: 'ableton-ambient-encounters',
        label: 'Ableton Ambient Encounters',
        families: ['synth'],
        samplePath: samplePathsById['ambient-encounters-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-phantasm',
        label: 'Ableton Phantasm',
        families: ['synth'],
        samplePath: samplePathsById['phantasm-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-ikembe',
        label: 'Ableton Ikembe',
        families: ['chromatic percussion'],
        samplePath: samplePathsById['ikembe-c2'],
        baseNote: 'C2'
      },
      {
        id: 'ableton-arco-metal',
        label: 'Ableton Arco Metal',
        families: ['texture'],
        samplePath: samplePathsById['arco-metal-fsharp5'],
        baseNote: 'F#5'
      }
    ]
  },
  {
    id: 'ableton-private-synth-lab',
    name: 'Ableton Private Synth Lab',
    quality: {
      sampleRate: 44100,
      bitDepth: 16
    },
    layerFamilies: ['synth', 'bass', 'chromatic percussion', 'texture'],
    instruments: [
      {
        id: 'ableton-dark-thought',
        label: 'Ableton Dark Thought',
        families: ['texture'],
        samplePath: samplePathsById['dark-thought-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-galactica',
        label: 'Ableton Galactica',
        families: ['synth'],
        samplePath: samplePathsById['galactica-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-smooth-synth',
        label: 'Ableton Smooth Synth',
        families: ['synth'],
        samplePath: samplePathsById['smooth-synth-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-saw-percussion',
        label: 'Ableton Saw Percussion',
        families: ['chromatic percussion'],
        samplePath: samplePathsById['saw-percussion-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-arp-poly-lead',
        label: 'Ableton ARP Poly Lead',
        families: ['synth'],
        samplePath: samplePathsById['arp-poly-lead-c4'],
        baseNote: 'C4'
      },
      {
        id: 'ableton-pulse-bass',
        label: 'Ableton Pulse Bass',
        families: ['bass'],
        samplePath: samplePathsById['pulse-bass-c2'],
        baseNote: 'C2'
      }
    ]
  }
];

const log = (...values) => {
  if (!quiet) console.log(...values);
};

async function main() {
  await fs.mkdir(privateSamplesRoot, { recursive: true });

  const converted = [];
  for (const sample of sampleSpecs) {
    const sourceRoot = sample.sourceRoot || abletonGrandPianoRoot;
    const sourcePath = path.join(sourceRoot, sample.sourceFile);
    const outputPath = path.join(privateSamplesRoot, sample.outputFile);

    await assertExists(sourcePath, `Missing Ableton source sample: ${sourcePath}`);

    if (!force && await fileExists(outputPath)) {
      converted.push({
        id: sample.id,
        sourcePath,
        outputPath,
        status: 'skipped'
      });
      continue;
    }

    await convertToWav(sourcePath, outputPath);
    converted.push({
      id: sample.id,
      sourcePath,
      outputPath,
      status: 'converted'
    });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    licenseNotice: 'Private local override generated from your installed Ableton Core Library. Do not commit or redistribute these assets.',
    soundSets: soundSetOverrides
  };

  await fs.writeFile(privateManifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  log(`Private sound-set sync complete: ${converted.filter((item) => item.status === 'converted').length} converted, ${converted.filter((item) => item.status === 'skipped').length} skipped.`);
  log(`Manifest written to ${privateManifestPath}`);
}

async function convertToWav(sourcePath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync('/usr/bin/afconvert', [
    '-f', 'WAVE',
    '-d', 'LEI16@44100',
    sourcePath,
    outputPath
  ]);
}

async function assertExists(targetPath, message) {
  if (!(await fileExists(targetPath))) {
    throw new Error(message);
  }
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
