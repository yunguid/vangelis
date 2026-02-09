import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const libraryPath = path.join(frontendRoot, 'src/data/russianMidiLibrary.json');
const outputDir = path.join(frontendRoot, 'public/midi/russian');

const args = new Set(process.argv.slice(2));
const forceDownload = args.has('--force');
const quiet = args.has('--quiet');

const log = (...values) => {
  if (!quiet) {
    console.log(...values);
  }
};

const library = JSON.parse(await fs.readFile(libraryPath, 'utf8'));

await fs.mkdir(outputDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const entry of library) {
  const targetPath = path.join(outputDir, `${entry.id}.mid`);
  const exists = await fileExists(targetPath);

  if (exists && !forceDownload) {
    skipped += 1;
    log(`[skip] ${entry.id} already present`);
    continue;
  }

  if (!entry.sourceUrl) {
    failed += 1;
    console.error(`[error] ${entry.id} has no sourceUrl`);
    continue;
  }

  try {
    log(`[download] ${entry.id}`);
    const response = await fetch(entry.sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(targetPath, buffer);
    downloaded += 1;
  } catch (error) {
    failed += 1;
    console.error(`[error] Failed ${entry.id}: ${error.message}`);
  }
}

log(`\nMIDI sync complete: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`);

if (failed > 0) {
  process.exitCode = 1;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
