import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const sourceDir = path.join(root, 'src');
const assetsDir = path.join(distDir, 'assets');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));

const roundKb = (bytes) => Number((bytes / 1024).toFixed(2));

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  }));
  return nested.flat();
}

async function measureFile(file) {
  const content = await readFile(file);
  return {
    file: path.relative(distDir, file),
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength
  };
}

const htmlPath = path.join(distDir, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const htmlMetric = await measureFile(htmlPath);
const assetPaths = (await walkFiles(assetsDir)).sort();
const assetMetrics = await Promise.all(assetPaths.map(measureFile));
const jsAssets = assetMetrics.filter(({ file }) => file.endsWith('.js'));
const cssAssets = assetMetrics.filter(({ file }) => file.endsWith('.css'));
const initialRefs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)|(?:src|href)="\/([^"?#]+)/g)]
  .map((match) => match[1] || match[2])
  .filter(Boolean);
const initialJs = jsAssets.filter(({ file }) => initialRefs.includes(file));
const initialCss = cssAssets.filter(({ file }) => initialRefs.includes(file));
const routeChunks = jsAssets.filter(({ file }) => (
  /(?:ControlKit|GeneratedSongStudy|MidiPipeline|SongStudy|SoundDesigner|StudySongs|VoiceLoopLab)/.test(file)
));
const worklets = jsAssets.filter(({ file }) => file.includes('worklet'));

const sourcePaths = (await walkFiles(sourceDir)).filter((file) => /\.(?:js|jsx)$/.test(file));
const sourceText = (await Promise.all(sourcePaths.map((file) => readFile(file, 'utf8')))).join('\n');
const sourceCssPaths = (await walkFiles(sourceDir)).filter((file) => file.endsWith('.css'));
const sourceCssText = (await Promise.all(sourceCssPaths.map((file) => readFile(file, 'utf8')))).join('\n');
const count = (pattern) => (sourceText.match(pattern) || []).length;
const countCss = (pattern) => (sourceCssText.match(pattern) || []).length;
const sum = (metrics, key) => metrics.reduce((total, metric) => total + metric[key], 0);
const largestInitial = [...initialJs].sort((a, b) => b.bytes - a.bytes)[0] || null;
const directRuntimeDependencies = Object.keys(packageJson.dependencies || {});
const productionLockPackages = Object.entries(packageLock.packages || {})
  .filter(([packagePath, metadata]) => packagePath && !metadata.dev);

const report = {
  generatedAt: new Date().toISOString(),
  build: {
    htmlKb: roundKb(htmlMetric.bytes),
    htmlGzipKb: roundKb(htmlMetric.gzipBytes),
    jsAssetCount: jsAssets.length,
    jsKb: roundKb(sum(jsAssets, 'bytes')),
    jsGzipKb: roundKb(sum(jsAssets, 'gzipBytes')),
    cssAssetCount: cssAssets.length,
    cssKb: roundKb(sum(cssAssets, 'bytes')),
    cssGzipKb: roundKb(sum(cssAssets, 'gzipBytes')),
    initialJsAssetCount: initialJs.length,
    initialJsKb: roundKb(sum(initialJs, 'bytes')),
    initialJsGzipKb: roundKb(sum(initialJs, 'gzipBytes')),
    initialCssAssetCount: initialCss.length,
    initialCssKb: roundKb(sum(initialCss, 'bytes')),
    initialCssGzipKb: roundKb(sum(initialCss, 'gzipBytes')),
    largestInitialChunk: largestInitial ? {
      file: largestInitial.file,
      kb: roundKb(largestInitial.bytes),
      gzipKb: roundKb(largestInitial.gzipBytes)
    } : null,
    routeChunkCount: routeChunks.length,
    routeChunks: routeChunks.map(({ file, bytes, gzipBytes }) => ({
      file,
      kb: roundKb(bytes),
      gzipKb: roundKb(gzipBytes)
    })),
    workletKb: roundKb(sum(worklets, 'bytes')),
    workletGzipKb: roundKb(sum(worklets, 'gzipBytes'))
  },
  staticSignals: {
    sourceModuleCount: sourcePaths.length,
    requestAnimationFrameCalls: count(/\brequestAnimationFrame\s*\(/g),
    cancelAnimationFrameCalls: count(/\bcancelAnimationFrame\s*\(/g),
    setIntervalCalls: count(/\bsetInterval\s*\(/g),
    setTimeoutCalls: count(/\bsetTimeout\s*\(/g),
    addEventListenerCalls: count(/\.addEventListener\s*\(/g),
    externalCssImportCalls: countCss(/@import\s+(?:url\()?['"]?https?:\/\//g),
    canvasElements: count(/<canvas\b/g),
    webglContextRequests: count(/getContext\s*\(\s*['"]webgl2?['"]/g)
  },
  networkHints: {
    earlyExternalStylesheets: [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(https?:\/\/[^"?#]+)/g)]
      .map((match) => match[1]),
    preconnectOrigins: [...html.matchAll(/<link[^>]+rel="preconnect"[^>]+href="(https?:\/\/[^"?#]+)/g)]
      .map((match) => match[1])
  },
  dependencySignals: {
    directRuntimeCount: directRuntimeDependencies.length,
    directRuntimeDependencies,
    productionPackageCount: productionLockPackages.length,
    lockPackageCount: Math.max(0, Object.keys(packageLock.packages || {}).length - 1)
  }
};

const budgetChecks = [
  ['D01 HTML raw', htmlMetric.bytes, 5 * 1024],
  ['D02 HTML gzip', htmlMetric.gzipBytes, 2 * 1024],
  ['D03 initial JS raw', sum(initialJs, 'bytes'), 350 * 1024],
  ['D04 initial JS gzip', sum(initialJs, 'gzipBytes'), 110 * 1024],
  ['D05 initial CSS raw', sum(initialCss, 'bytes'), 130 * 1024],
  ['D06 initial CSS gzip', sum(initialCss, 'gzipBytes'), 25 * 1024],
  ['D07 largest eager JS gzip', largestInitial?.gzipBytes || 0, 55 * 1024],
  ['D14 worklet raw', sum(worklets, 'bytes'), 38.7 * 1024]
];
const failures = budgetChecks
  .filter(([, actual, maximum]) => actual > maximum)
  .map(([name, actual, maximum]) => ({
    name,
    actualKb: roundKb(actual),
    maximumKb: roundKb(maximum)
  }));
const countBudgetChecks = [
  ['Guard initial JS requests', initialJs.length, 2],
  ['M11 explicit RAF sites', report.staticSignals.requestAnimationFrameCalls, 7],
  ['Guard raw interval sites', report.staticSignals.setIntervalCalls, 0],
  ['Guard nested external CSS imports', report.staticSignals.externalCssImportCalls, 0],
  ['D11 direct runtime dependencies', directRuntimeDependencies.length, 5],
  ['D11 production lock packages', productionLockPackages.length, 10]
];
failures.push(...countBudgetChecks
  .filter(([, actual, maximum]) => actual > maximum)
  .map(([name, actual, maximum]) => ({ name, actual, maximum })));
if (routeChunks.length < 7) {
  failures.push({
    name: 'D09 secondary route chunks',
    actual: routeChunks.length,
    minimum: 7
  });
}

report.budgets = {
  passed: failures.length === 0,
  checks: budgetChecks.length + countBudgetChecks.length + 1,
  failures
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
