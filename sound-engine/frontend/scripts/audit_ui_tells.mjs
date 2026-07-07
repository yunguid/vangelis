#!/usr/bin/env node
/**
 * UI "tell" census for THE INTERFACE PURGE loop (see INTERFACE_PURGE.md).
 *
 * Scans src/**\/*.{css,jsx,js} (skipping *.test.* files and the frozen audio
 * engine under src/audio/ and utils/audioEngine/) and counts the classes of
 * "AI-coded" visual tell named in INTERFACE_PURGE.md §3 (gate G5) / §4:
 *
 *   - gradients      linear-gradient( / radial-gradient( / conic-gradient(
 *   - glowShadows    box-shadow with an rgba/hsla color + blur >= 12px, or
 *                    "glow" in a custom-property/class name
 *   - pillRadii      border-radius > 8px (px values), plus 9999px/999px pill
 *                    tokens; "50%" radii are listed separately for human
 *                    review (mostly genuine circles) and NOT counted
 *   - chipsAndTags   identifiers/class names matching /tag|chip|badge|pill/i
 *   - animatedDots   @keyframes/animation or class names matching
 *                    /pulse|blink|dot/i combined with a 50% border-radius
 *                    context, or a literal bullet character in JSX
 *   - studioOriginal occurrences of "Vangelis Studio Original" / "Studio
 *                    Original" anywhere in src/ and public/
 *
 * This is a census, not a gate: it always exits 0. The count is the number
 * the ledger tracks and G5 requires to strictly decrease to zero.
 *
 * Usage:
 *   node scripts/audit_ui_tells.mjs
 *   npm run audit:ui
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'src');
const PUBLIC_DIR = join(ROOT, 'public');

const SCAN_EXTENSIONS = new Set(['.css', '.jsx', '.js']);
// Frozen engine paths (INTERFACE_PURGE.md G3) — never scanned for tells.
const SKIP_DIR_PREFIXES = [
  join('src', 'audio'),
  join('src', 'utils', 'audioEngine'),
];

// --- filesystem walk --------------------------------------------------------

function isSkippedDir(relPath) {
  return SKIP_DIR_PREFIXES.some(
    (prefix) => relPath === prefix || relPath.startsWith(prefix + '/') || relPath.startsWith(prefix + '\\'),
  );
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      if (isSkippedDir(rel)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function collectSourceFiles() {
  const all = walk(SRC_DIR, []);
  return all.filter((f) => {
    const rel = relative(ROOT, f);
    if (isSkippedDir(dirname(rel))) return false;
    const base = f.split('/').pop();
    if (base.includes('.test.')) return false;
    return SCAN_EXTENSIONS.has(extname(f));
  });
}

function collectAllTextFiles(dir) {
  // For the studioOriginal scan: everything in src/ and public/, no extension
  // filter (the string could appear in JSON manifests, etc.), still skipping
  // *.test.* and the frozen engine paths (SKIP_DIR_PREFIXES).
  const all = walk(dir, []);
  return all.filter((f) => {
    const rel = relative(ROOT, f);
    if (isSkippedDir(dirname(rel))) return false;
    const base = f.split('/').pop();
    if (base.includes('.test.')) return false;
    // Skip obvious binary assets.
    const ext = extname(f).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.woff', '.woff2', '.ttf', '.ico'].includes(ext)) {
      return false;
    }
    return true;
  });
}

// --- helpers -----------------------------------------------------------------

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function relPath(file) {
  return relative(ROOT, file);
}

function pushHit(bucket, file, line, snippet) {
  bucket.push({ file: relPath(file), line, snippet: snippet.trim().slice(0, 140) });
}

function getLineText(content, index) {
  const start = content.lastIndexOf('\n', index) + 1;
  let end = content.indexOf('\n', index);
  if (end === -1) end = content.length;
  return content.slice(start, end);
}

// --- category scanners ---------------------------------------------------

const GRADIENT_RE = /(linear|radial|conic)-gradient\s*\(/g;

function scanGradients(file, content, hits) {
  let m;
  GRADIENT_RE.lastIndex = 0;
  while ((m = GRADIENT_RE.exec(content))) {
    const line = lineOf(content, m.index);
    pushHit(hits, file, line, getLineText(content, m.index));
  }
}

// box-shadow: ... rgba(...)/hsla(...) ... <blur>px ... — blur is typically the
// 3rd length in `offset-x offset-y blur-radius [spread] color`. We look at
// each box-shadow declaration's value and pull all px lengths + a color fn.
const BOX_SHADOW_DECL_RE = /box-shadow\s*:\s*([^;]+);/g;
const GLOW_NAME_RE = /glow/i;
const PX_LENGTH_RE = /(-?\d+(?:\.\d+)?)px/g;
const COLOR_FN_RE = /(rgba|hsla)\s*\(/i;

function scanGlowShadows(file, content, hits) {
  // 1) box-shadow declarations with a color + blur >= 12px
  let m;
  BOX_SHADOW_DECL_RE.lastIndex = 0;
  while ((m = BOX_SHADOW_DECL_RE.exec(content))) {
    const value = m[1];
    if (!COLOR_FN_RE.test(value)) continue;
    const lengths = [...value.matchAll(PX_LENGTH_RE)].map((x) => parseFloat(x[1]));
    // Each comma-separated shadow layer: offsetX offsetY blur [spread]. Blur
    // is the 3rd length in that layer's own token run. Simplify: if ANY px
    // length in the declaration is >= 12 alongside a color fn, flag it (this
    // over-counts multi-shadow declarations slightly but never under-counts).
    const hasBigBlur = lengths.some((v) => Math.abs(v) >= 12);
    if (hasBigBlur) {
      const line = lineOf(content, m.index);
      pushHit(hits, file, line, `box-shadow: ${value}`);
    }
  }
  // 2) "glow" literally in a custom property or class/identifier name
  const lines = content.split('\n');
  lines.forEach((lineText, idx) => {
    if (GLOW_NAME_RE.test(lineText)) {
      // Only count if it looks like a declared name: --foo-glow, .glow-x,
      // className="...glow...", camelCase glow identifiers — not prose.
      const looksLikeIdentifier =
        /--[\w-]*glow[\w-]*/i.test(lineText) ||
        /\.[\w-]*glow[\w-]*/i.test(lineText) ||
        /className\s*=\s*["'{][^"'}]*glow/i.test(lineText) ||
        /\b\w*[Gg]low\w*\s*[:=]/.test(lineText);
      if (looksLikeIdentifier) {
        pushHit(hits, file, idx + 1, lineText);
      }
    }
  });
}

// border-radius: count px values > 8 and 9999px/999px pill tokens; "50%" goes
// to a separate uncounted bucket (circularity not judged, human review only).
const BORDER_RADIUS_DECL_RE = /border-radius\s*:\s*([^;]+);/g;
const BORDER_RADIUS_JSX_RE = /borderRadius\s*:\s*['"`]?(-?\d+(?:\.\d+)?)(px)?['"`]?/g;

function classifyRadiusValue(token) {
  const t = token.trim();
  if (t === '9999px' || t === '999px') return { kind: 'pill-token', px: null };
  if (t === '50%') return { kind: 'fifty-percent', px: null };
  const pxMatch = t.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (pxMatch) return { kind: 'px', px: parseFloat(pxMatch[1]) };
  return null;
}

function scanPillRadii(file, content, hits, fiftyPercentHits) {
  let m;
  BORDER_RADIUS_DECL_RE.lastIndex = 0;
  while ((m = BORDER_RADIUS_DECL_RE.exec(content))) {
    const rawValue = m[1].trim();
    // border-radius can have up to 4 space-separated values (corners) and an
    // optional "/" for elliptical radii — split on whitespace and "/".
    const tokens = rawValue.split(/[\s/]+/).filter(Boolean);
    let flagged = false;
    let fiftyFlagged = false;
    for (const tok of tokens) {
      const classified = classifyRadiusValue(tok);
      if (!classified) continue;
      if (classified.kind === 'px' && classified.px > 8) flagged = true;
      if (classified.kind === 'pill-token') flagged = true;
      if (classified.kind === 'fifty-percent') fiftyFlagged = true;
    }
    const line = lineOf(content, m.index);
    if (flagged) pushHit(hits, file, line, `border-radius: ${rawValue}`);
    if (fiftyFlagged) pushHit(fiftyPercentHits, file, line, `border-radius: ${rawValue}`);
  }
  // Inline style objects in JSX: borderRadius: 12 or borderRadius: '12px'
  BORDER_RADIUS_JSX_RE.lastIndex = 0;
  while ((m = BORDER_RADIUS_JSX_RE.exec(content))) {
    const px = parseFloat(m[1]);
    if (px > 8) {
      const line = lineOf(content, m.index);
      pushHit(hits, file, line, getLineText(content, m.index));
    }
  }
}

const CHIP_TAG_RE = /(tag|chip|badge|pill)/i;
// Avoid false-positives on unrelated English words that happen to contain
// these substrings by requiring word-ish boundaries or camel/kebab/class
// context (className=, class=, CSS selector ".foo", identifier names).
const CHIP_TAG_CONTEXT_RE =
  /className\s*=\s*["'`{][^"'`}]*\b(tag|chip|badge|pill)/i;
const CHIP_TAG_CSS_SELECTOR_RE = /\.[\w-]*\b(tag|chip|badge|pill)\b[\w-]*/i;
const CHIP_TAG_IDENTIFIER_RE = /\b(tag|chip|badge|pill)[A-Za-z]*\b\s*[:=(]/i;

function scanChipsAndTags(file, content, hits) {
  const lines = content.split('\n');
  lines.forEach((lineText, idx) => {
    if (!CHIP_TAG_RE.test(lineText)) return;
    if (
      CHIP_TAG_CONTEXT_RE.test(lineText) ||
      CHIP_TAG_CSS_SELECTOR_RE.test(lineText) ||
      CHIP_TAG_IDENTIFIER_RE.test(lineText)
    ) {
      pushHit(hits, file, idx + 1, lineText);
    }
  });
}

const ANIM_NAME_RE = /(pulse|blink|dot)/i;
const KEYFRAMES_RE = /@keyframes\s+[\w-]*(pulse|blink|dot)[\w-]*/i;
const ANIMATION_DECL_RE = /animation(-name)?\s*:\s*[^;]*\b(pulse|blink|dot)[\w-]*/i;
const CLASS_ANIM_NAME_RE = /\.[\w-]*(pulse|blink|dot)[\w-]*/i;
const BULLET_CHAR_RE = /[●•]/;

function scanAnimatedDots(file, content, ext, hits) {
  const lines = content.split('\n');
  lines.forEach((lineText, idx) => {
    const line = idx + 1;
    if (
      KEYFRAMES_RE.test(lineText) ||
      ANIMATION_DECL_RE.test(lineText) ||
      CLASS_ANIM_NAME_RE.test(lineText)
    ) {
      pushHit(hits, file, line, lineText);
      return;
    }
    if ((ext === '.jsx' || ext === '.js') && BULLET_CHAR_RE.test(lineText)) {
      pushHit(hits, file, line, lineText);
      return;
    }
    // Generic /pulse|blink|dot/ class name combined with border-radius: 50%
    // on the SAME declaration block is hard to detect line-by-line reliably;
    // we additionally flag any standalone class selector name match here so
    // humans can eyeball false positives (e.g. ".dotted-border").
    if (ANIM_NAME_RE.test(lineText) && /border-radius\s*:\s*50%/.test(lineText)) {
      pushHit(hits, file, line, lineText);
    }
  });
}

const STUDIO_ORIGINAL_RE = /Vangelis Studio Original|Studio Original/g;

function scanStudioOriginal(file, content, hits) {
  let m;
  STUDIO_ORIGINAL_RE.lastIndex = 0;
  while ((m = STUDIO_ORIGINAL_RE.exec(content))) {
    const line = lineOf(content, m.index);
    pushHit(hits, file, line, getLineText(content, m.index));
  }
}

// --- run -------------------------------------------------------------------

const categories = {
  gradients: [],
  glowShadows: [],
  pillRadii: [],
  pillRadiiFiftyPercent: [], // separate listing, NOT included in any total
  chipsAndTags: [],
  animatedDots: [],
  studioOriginal: [],
};

const sourceFiles = collectSourceFiles();

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  const ext = extname(file);
  scanGradients(file, content, categories.gradients);
  scanGlowShadows(file, content, categories.glowShadows);
  scanPillRadii(file, content, categories.pillRadii, categories.pillRadiiFiftyPercent);
  scanChipsAndTags(file, content, categories.chipsAndTags);
  scanAnimatedDots(file, content, ext, categories.animatedDots);
}

// studioOriginal scans src/ AND public/, independently of the css/jsx/js filter.
const studioScanFiles = [...collectAllTextFiles(SRC_DIR), ...collectAllTextFiles(PUBLIC_DIR)];
for (const file of studioScanFiles) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  scanStudioOriginal(file, content, categories.studioOriginal);
}

// --- report ------------------------------------------------------------------

const CATEGORY_ORDER = [
  ['gradients', 'Gradients (linear/radial/conic-gradient)'],
  ['glowShadows', 'Glow shadows (rgba/hsla blur >= 12px, or "glow" identifiers)'],
  ['pillRadii', 'Pill radii (border-radius > 8px, plus 999px/9999px pill tokens; 50% listed separately, uncounted)'],
  ['chipsAndTags', 'Chips & tags (tag|chip|badge|pill identifiers)'],
  ['animatedDots', 'Animated dots (pulse|blink|dot animations/classes, bullet chars)'],
  ['studioOriginal', '"Vangelis Studio Original" / "Studio Original" text'],
];

function printTable() {
  const rows = CATEGORY_ORDER.map(([key, label]) => [label, String(categories[key].length)]);
  const labelWidth = Math.max(...rows.map((r) => r[0].length), 'Category'.length);
  const countWidth = Math.max(...rows.map((r) => r[1].length), 'Count'.length);
  const line = (a, b) => `| ${a.padEnd(labelWidth)} | ${b.padStart(countWidth)} |`;
  const sep = `|-${'-'.repeat(labelWidth)}-|-${'-'.repeat(countWidth)}-|`;
  console.log(line('Category', 'Count'));
  console.log(sep);
  for (const row of rows) console.log(line(row[0], row[1]));
  console.log(sep);
  const total = CATEGORY_ORDER.reduce((sum, [key]) => sum + categories[key].length, 0);
  console.log(line('TOTAL', String(total)));
  return total;
}

function printListing() {
  for (const [key, label] of CATEGORY_ORDER) {
    const hits = categories[key];
    console.log('');
    console.log(`--- ${label} (${hits.length}) ---`);
    if (hits.length === 0) {
      console.log('  (none)');
      continue;
    }
    // Group by file for readability.
    const byFile = new Map();
    for (const hit of hits) {
      if (!byFile.has(hit.file)) byFile.set(hit.file, []);
      byFile.get(hit.file).push(hit);
    }
    const sortedFiles = [...byFile.keys()].sort();
    for (const file of sortedFiles) {
      console.log(`  ${file}`);
      for (const hit of byFile.get(file)) {
        console.log(`    ${file}:${hit.line}  ${hit.snippet}`);
      }
    }
    if (key === 'pillRadii' && categories.pillRadiiFiftyPercent.length > 0) {
      console.log(`  (additionally ${categories.pillRadiiFiftyPercent.length} "50%" radii — circularity not judged, listed for human review, not counted)`);
    }
  }
}

console.log('UI TELL CENSUS — sound-engine/frontend/src (skipping *.test.*, src/audio/, src/utils/audioEngine/)');
console.log('');
const total = printTable();
printListing();
console.log('');
console.log(`TELL CENSUS TOTAL: ${total}`);

process.exit(0);
