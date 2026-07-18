import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const sourceDir = path.join(root, 'src');
const publicDir = path.join(root, 'public');
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
const manifest = JSON.parse(await readFile(path.join(distDir, '.vite', 'manifest.json'), 'utf8'));
const distPaths = await walkFiles(distDir);
const publicPaths = await walkFiles(publicDir);
const deploymentBytes = (await Promise.all(distPaths.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0);
const publicStaticBytes = (await Promise.all(publicPaths.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0);
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
const assetMetricByFile = new Map(assetMetrics.map((metric) => [metric.file, metric]));
const sum = (metrics, key) => metrics.reduce((total, metric) => total + metric[key], 0);

const routeEntries = [
  {
    route: 'home',
    entries: ['src/App.jsx', 'src/components/Scene.jsx', 'src/components/WaveCandy.jsx']
  },
  { route: 'control-kit', entries: ['src/pages/ControlKitPage.jsx'] },
  { route: 'generated-study', entries: ['src/pages/GeneratedSongStudyPage.jsx'] },
  { route: 'midi-pipeline', entries: ['src/pages/MidiPipelinePage.jsx'] },
  { route: 'song-study', entries: ['src/pages/SongStudyPage.jsx'] },
  { route: 'sound-designer', entries: ['src/pages/SoundDesignerPage.jsx'] },
  { route: 'study-songs', entries: ['src/pages/StudySongsPage.jsx'] },
  { route: 'voice-loop', entries: ['src/pages/VoiceLoopLabPage.jsx'] }
];
const fullSidebarManifestRecord = Object.values(manifest).find((record) => (
  record.dynamicImports?.includes('src/components/Sidebar/MidiTab.jsx')
  && record.dynamicImports?.includes('src/components/Sidebar/SoundTab.jsx')
));
const fullSidebarFile = fullSidebarManifestRecord?.file || null;
const audioEngineManifestRecord = Object.values(manifest).find((record) => (
  record.assets?.some((file) => file.includes('delay-worklet'))
  && record.assets?.some((file) => file.includes('reverb-worklet'))
));
const audioEngineFile = audioEngineManifestRecord?.file || null;
const songStudyFile = manifest['src/pages/SongStudyPage.jsx']?.file || null;
const waveCandyFile = manifest['src/components/WaveCandy.jsx']?.file || null;

function collectRouteClosure(entryKeys) {
  const visited = new Set();
  const jsFiles = new Set();
  const cssFiles = new Set();

  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const record = manifest[key];
    if (!record) return;
    if (record.file?.endsWith('.js')) jsFiles.add(record.file);
    (record.css || []).forEach((file) => cssFiles.add(file));
    (record.imports || []).forEach(visit);
  };
  entryKeys.forEach(visit);

  const js = [...jsFiles].map((file) => assetMetricByFile.get(file)).filter(Boolean);
  const css = [...cssFiles].map((file) => assetMetricByFile.get(file)).filter(Boolean);
  return {
    jsAssetCount: js.length,
    jsKb: roundKb(sum(js, 'bytes')),
    jsGzipKb: roundKb(sum(js, 'gzipBytes')),
    cssAssetCount: css.length,
    cssKb: roundKb(sum(css, 'bytes')),
    cssGzipKb: roundKb(sum(css, 'gzipBytes')),
    includesFactoryPresetBank: [...jsFiles].some((file) => file.includes('factoryPresets')),
    includesWebMidiController: [...jsFiles].some((file) => file.includes('webMidiController')),
    includesSoundControlPanel: [...jsFiles].some((file) => file.includes('SoundTab')),
    includesMidiParser: [...jsFiles].some((file) => file.includes('midiParser')),
    includesAudioEngine: audioEngineFile ? jsFiles.has(audioEngineFile) : false,
    includesFullSidebar: fullSidebarFile ? jsFiles.has(fullSidebarFile) : false,
    includesSongStudyPlayer: songStudyFile ? jsFiles.has(songStudyFile) : false,
    includesWaveCandy: waveCandyFile ? jsFiles.has(waveCandyFile) : false
  };
}

const routeClosures = routeEntries.map(({ route, entries }) => ({
  route,
  ...collectRouteClosure(entries)
}));
const factoryPresetChunk = jsAssets.find(({ file }) => file.includes('factoryPresets')) || null;
const webMidiControllerChunk = jsAssets.find(({ file }) => file.includes('webMidiController')) || null;
const soundControlPanelChunk = jsAssets.find(({ file }) => file.includes('SoundTab')) || null;
const midiParserChunk = jsAssets.find(({ file }) => file.includes('midiParser')) || null;
const fullSidebarChunk = fullSidebarFile ? assetMetricByFile.get(fullSidebarFile) || null : null;
const audioEngineChunk = audioEngineFile ? assetMetricByFile.get(audioEngineFile) || null : null;
const appManifestEntry = manifest['src/App.jsx'];
const appDefersMidiParser = appManifestEntry?.dynamicImports?.includes('src/utils/midiParser.js') || false;
const generatedStudyManifestEntry = manifest['src/pages/GeneratedSongStudyPage.jsx'];
const generatedDefersSongStudyPlayer = (
  generatedStudyManifestEntry?.dynamicImports?.includes('src/pages/SongStudyPage.jsx') || false
);
const soundDesignerManifestEntry = manifest['src/pages/SoundDesignerPage.jsx'];
const soundDesignerDefersWaveCandy = (
  soundDesignerManifestEntry?.dynamicImports?.includes('src/components/WaveCandy.jsx') || false
);

const sourcePaths = (await walkFiles(sourceDir)).filter((file) => /\.(?:js|jsx)$/.test(file));
const sourceText = (await Promise.all(sourcePaths.map((file) => readFile(file, 'utf8')))).join('\n');
const sourceCssPaths = (await walkFiles(sourceDir)).filter((file) => file.endsWith('.css'));
const sourceCssText = (await Promise.all(sourceCssPaths.map((file) => readFile(file, 'utf8')))).join('\n');
const appHeaderSource = await readFile(path.join(sourceDir, 'components', 'AppHeader.jsx'), 'utf8');
const appHeaderImportsAudioEngine = /from\s+['"][^'"]*audioEngine(?:\.js)?['"]/.test(appHeaderSource);
const count = (pattern) => (sourceText.match(pattern) || []).length;
const countCss = (pattern) => (sourceCssText.match(pattern) || []).length;
const largestInitial = [...initialJs].sort((a, b) => b.bytes - a.bytes)[0] || null;
const directRuntimeDependencies = Object.keys(packageJson.dependencies || {});
const productionLockPackages = Object.entries(packageLock.packages || {})
  .filter(([packagePath, metadata]) => packagePath && !metadata.dev);
const obsoleteWasmBuildPlugins = [
  'vite-plugin-top-level-await',
  'vite-plugin-wasm'
].filter((dependency) => packageJson.devDependencies?.[dependency]);

const report = {
  generatedAt: new Date().toISOString(),
  build: {
    deploymentFileCount: distPaths.length,
    deploymentKb: roundKb(deploymentBytes),
    publicStaticFileCount: publicPaths.length,
    publicStaticKb: roundKb(publicStaticBytes),
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
    workletGzipKb: roundKb(sum(worklets, 'gzipBytes')),
    deferredFactoryPresetChunk: factoryPresetChunk ? {
      file: factoryPresetChunk.file,
      kb: roundKb(factoryPresetChunk.bytes),
      gzipKb: roundKb(factoryPresetChunk.gzipBytes)
    } : null,
    deferredWebMidiControllerChunk: webMidiControllerChunk ? {
      file: webMidiControllerChunk.file,
      kb: roundKb(webMidiControllerChunk.bytes),
      gzipKb: roundKb(webMidiControllerChunk.gzipBytes)
    } : null,
    deferredSoundControlPanelChunk: soundControlPanelChunk ? {
      file: soundControlPanelChunk.file,
      kb: roundKb(soundControlPanelChunk.bytes),
      gzipKb: roundKb(soundControlPanelChunk.gzipBytes)
    } : null,
    deferredMidiParserChunk: midiParserChunk ? {
      file: midiParserChunk.file,
      kb: roundKb(midiParserChunk.bytes),
      gzipKb: roundKb(midiParserChunk.gzipBytes)
    } : null,
    fullSidebarChunk: fullSidebarChunk ? {
      file: fullSidebarChunk.file,
      kb: roundKb(fullSidebarChunk.bytes),
      gzipKb: roundKb(fullSidebarChunk.gzipBytes)
    } : null,
    audioEngineChunk: audioEngineChunk ? {
      file: audioEngineChunk.file,
      kb: roundKb(audioEngineChunk.bytes),
      gzipKb: roundKb(audioEngineChunk.gzipBytes)
    } : null,
    appDefersMidiParser,
    generatedDefersSongStudyPlayer,
    soundDesignerDefersWaveCandy,
    routeClosures
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
    webglContextRequests: count(/getContext\s*\(\s*['"]webgl2?['"]/g),
    wasmModuleImports: count(/(?:from\s+['"][^'"]*\.wasm(?:\?[^'"]*)?['"]|import\s*\(\s*['"][^'"]*\.wasm)/g),
    appHeaderImportsAudioEngine
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
    obsoleteWasmBuildPlugins,
    productionPackageCount: productionLockPackages.length,
    lockPackageCount: Math.max(0, Object.keys(packageLock.packages || {}).length - 1)
  }
};

const budgetChecks = [
  ['D00 deployment raw', deploymentBytes, 1.65 * 1024 * 1024],
  ['D00 public static raw', publicStaticBytes, 0.95 * 1024 * 1024],
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
const routeBudgetChecks = [
  ['D12 max route JS gzip', Math.max(...routeClosures.map(({ jsGzipKb }) => jsGzipKb)), 100],
  ['D13 max route CSS gzip', Math.max(...routeClosures.map(({ cssGzipKb }) => cssGzipKb)), 18]
];
failures.push(...routeBudgetChecks
  .filter(([, actual, maximum]) => actual > maximum)
  .map(([name, actual, maximum]) => ({ name, actualKb: actual, maximumKb: maximum })));
const unresolvedRouteClosures = routeClosures.filter(({ jsAssetCount }) => jsAssetCount === 0);
if (unresolvedRouteClosures.length > 0) {
  failures.push({
    name: 'Guard manifest route closures',
    unresolved: unresolvedRouteClosures.map(({ route }) => route)
  });
}
if (!factoryPresetChunk) {
  failures.push({ name: 'Guard deferred factory preset chunk', actual: 0, minimum: 1 });
}
const soundDesignerClosure = routeClosures.find(({ route }) => route === 'sound-designer');
if (soundDesignerClosure?.includesFactoryPresetBank) {
  failures.push({ name: 'Guard folded preset bank deferral', actual: 'eager', expected: 'deferred' });
}
if (!webMidiControllerChunk) {
  failures.push({ name: 'Guard deferred Web MIDI controller chunk', actual: 0, minimum: 1 });
}
const homeClosure = routeClosures.find(({ route }) => route === 'home');
if (homeClosure?.includesWebMidiController) {
  failures.push({ name: 'Guard Web MIDI startup deferral', actual: 'eager', expected: 'deferred' });
}
if (!soundControlPanelChunk) {
  failures.push({ name: 'Guard deferred sound control panel chunk', actual: 0, minimum: 1 });
}
if (soundDesignerClosure?.includesSoundControlPanel) {
  failures.push({ name: 'Guard Sound Designer control-panel isolation', actual: 'shared', expected: 'isolated' });
}
if (!midiParserChunk) {
  failures.push({ name: 'Guard deferred MIDI parser chunk', actual: 0, minimum: 1 });
}
if (!appDefersMidiParser) {
  failures.push({ name: 'Guard App MIDI parser interaction import', actual: 'static', expected: 'dynamic' });
}
if (homeClosure?.includesMidiParser) {
  failures.push({ name: 'Guard home MIDI parser deferral', actual: 'eager', expected: 'deferred' });
}
if (appHeaderImportsAudioEngine) {
  failures.push({ name: 'Guard passive AppHeader engine isolation', actual: 'coupled', expected: 'controlled' });
}
const passiveRouteNames = new Set(['control-kit', 'midi-pipeline', 'study-songs', 'voice-loop']);
const passiveRoutesWithAudioEngine = routeClosures
  .filter(({ route, includesAudioEngine }) => passiveRouteNames.has(route) && includesAudioEngine)
  .map(({ route }) => route);
if (passiveRoutesWithAudioEngine.length > 0) {
  failures.push({
    name: 'Guard passive route audio-engine isolation',
    routes: passiveRoutesWithAudioEngine,
    expected: 'no audioEngine chunk'
  });
}
if (!audioEngineChunk) {
  failures.push({ name: 'Guard audio-engine chunk identity', actual: 0, minimum: 1 });
}
if (!fullSidebarChunk) {
  failures.push({ name: 'Guard isolated full sidebar chunk', actual: 0, minimum: 1 });
}
const navigationOnlyRouteNames = new Set([
  'control-kit',
  'generated-study',
  'midi-pipeline',
  'song-study',
  'study-songs',
  'voice-loop'
]);
const navigationRoutesWithFullSidebar = routeClosures
  .filter(({ route, includesFullSidebar }) => navigationOnlyRouteNames.has(route) && includesFullSidebar)
  .map(({ route }) => route);
if (navigationRoutesWithFullSidebar.length > 0) {
  failures.push({
    name: 'Guard navigation-only route sidebar isolation',
    routes: navigationRoutesWithFullSidebar,
    expected: 'rail-only chrome'
  });
}
if (!generatedDefersSongStudyPlayer) {
  failures.push({ name: 'Guard Generated Study player transition import', actual: 'static', expected: 'dynamic' });
}
const generatedStudyClosure = routeClosures.find(({ route }) => route === 'generated-study');
if (
  generatedStudyClosure?.includesSongStudyPlayer
  || generatedStudyClosure?.includesMidiParser
  || generatedStudyClosure?.includesAudioEngine
) {
  failures.push({
    name: 'Guard Generated Study status-shell isolation',
    actual: 'player dependencies in static closure',
    expected: 'status shell only'
  });
}
if (!soundDesignerDefersWaveCandy) {
  failures.push({ name: 'Guard Sound Designer visualizer import', actual: 'static', expected: 'dynamic' });
}
if (soundDesignerClosure?.includesWaveCandy) {
  failures.push({ name: 'Guard Sound Designer visualizer isolation', actual: 'eager', expected: 'deferred' });
}
if (obsoleteWasmBuildPlugins.length > 0) {
  failures.push({ name: 'Guard retired WASM build plugins', dependencies: obsoleteWasmBuildPlugins });
}
if (report.staticSignals.wasmModuleImports > 0) {
  failures.push({ name: 'Guard retired WASM module imports', actual: report.staticSignals.wasmModuleImports, maximum: 0 });
}
if (routeChunks.length < 7) {
  failures.push({
    name: 'D09 secondary route chunks',
    actual: routeChunks.length,
    minimum: 7
  });
}

report.budgets = {
  passed: failures.length === 0,
  checks: budgetChecks.length + countBudgetChecks.length + routeBudgetChecks.length + 22,
  failures
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
