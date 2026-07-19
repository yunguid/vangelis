import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  SCENE_ACTIVE_FRAME_INTERVAL_MS,
  SCENE_IDLE_FRAME_INTERVAL_MS,
  WAVE_CANDY_FRAME_INTERVAL_MS
} from '../src/utils/visualFramePolicy.js';
import {
  GONIOMETER_POINTS_PER_CSS_PIXEL,
  MONO_ANALYSER_FFT_SIZE,
  STEREO_ANALYSER_FFT_SIZE,
  STEREO_VISUAL_SAMPLE_STRIDE,
  getGoniometerTraceStride,
  getStereoPairEvaluationsPerFrame,
  getWaveCandySamplesPerFrame
} from '../src/utils/audioAnalysisPolicy.js';

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
const publicRelativePaths = publicPaths.map((file) => path.relative(publicDir, file));
const assetPaths = (await walkFiles(assetsDir)).sort();
const assetMetrics = await Promise.all(assetPaths.map(measureFile));
const jsAssets = assetMetrics.filter(({ file }) => file.endsWith('.js'));
const cssAssets = assetMetrics.filter(({ file }) => file.endsWith('.css'));
const cssTextByFile = new Map(await Promise.all(cssAssets.map(async ({ file }) => (
  [file, await readFile(path.join(distDir, file), 'utf8')]
))));
const keyboardCssAsset = cssAssets.find(({ file }) => (
  cssTextByFile.get(file)?.includes('.keyboard-wrapper')
)) || null;
const keyboardCssFile = keyboardCssAsset?.file || null;
const homeOverlayCssAsset = cssAssets.find(({ file }) => (
  cssTextByFile.get(file)?.includes('.shortcuts-overlay')
)) || null;
const homeOverlayCssFile = homeOverlayCssAsset?.file || null;
const initialRefs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)|(?:src|href)="\/([^"?#]+)/g)]
  .map((match) => match[1] || match[2])
  .filter(Boolean);
const initialJs = jsAssets.filter(({ file }) => initialRefs.includes(file));
const initialCss = cssAssets.filter(({ file }) => initialRefs.includes(file));
const initialCssText = initialCss.map(({ file }) => cssTextByFile.get(file) || '').join('\n');
const routeChunks = jsAssets.filter(({ file }) => (
  /(?:ControlKit|GeneratedSongStudy|MidiPipeline|SongStudy|SoundDesigner|StudySongs|VoiceLoopLab)/.test(file)
));
const worklets = jsAssets.filter(({ file }) => file.includes('worklet'));
const assetMetricByFile = new Map(assetMetrics.map((metric) => [metric.file, metric]));
const sum = (metrics, key) => metrics.reduce((total, metric) => total + metric[key], 0);

const routeEntries = [
  {
    route: 'home',
    entries: ['src/App.jsx']
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
const soundControlPanelManifestRecord = manifest['src/components/Sidebar/SoundTab.jsx'] || null;
const soundControlPanelCssFile = soundControlPanelManifestRecord?.css?.[0] || null;
const audioEngineManifestRecord = Object.values(manifest).find((record) => (
  record.assets?.some((file) => file.includes('delay-worklet'))
  && record.assets?.some((file) => file.includes('reverb-worklet'))
));
const audioEngineFile = audioEngineManifestRecord?.file || null;
const audioEngineRuntimeManifestRecord = manifest['src/utils/audioEngineRuntime.js'] || null;
const songStudyFile = manifest['src/pages/SongStudyPage.jsx']?.file || null;
const waveCandyManifestRecord = manifest['src/components/WaveCandy.jsx'] || null;
const waveCandyFile = waveCandyManifestRecord?.file || null;
const sceneFile = manifest['src/components/Scene.jsx']?.file || null;
const birdsEyeRadarManifestRecord = manifest['src/components/BirdsEyeRadar.jsx'] || null;
const birdsEyeRadarFile = birdsEyeRadarManifestRecord?.file || null;
const advancedSoundDesignerStagesFile = manifest['src/pages/SoundDesignerAdvancedStages.jsx']?.file || null;
const audioControlPrimitivesFile = Object.entries(manifest)
  .find(([key]) => key.includes('audioControlPrimitives'))?.[1]?.file || null;

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
    includesKeyboardCss: keyboardCssFile ? cssFiles.has(keyboardCssFile) : false,
    includesSoundControlPanelCss: soundControlPanelCssFile
      ? cssFiles.has(soundControlPanelCssFile)
      : false,
    includesHomeOverlayCss: homeOverlayCssFile ? cssFiles.has(homeOverlayCssFile) : false,
    includesFactoryPresetBank: [...jsFiles].some((file) => file.includes('factoryPresets')),
    includesWebMidiController: [...jsFiles].some((file) => file.includes('webMidiController')),
    includesSoundControlPanel: [...jsFiles].some((file) => file.includes('SoundTab')),
    includesMidiParser: [...jsFiles].some((file) => file.includes('midiParser')),
    includesAudioEngine: audioEngineFile ? jsFiles.has(audioEngineFile) : false,
    includesFullSidebar: fullSidebarFile ? jsFiles.has(fullSidebarFile) : false,
    includesSongStudyPlayer: songStudyFile ? jsFiles.has(songStudyFile) : false,
    includesWaveCandy: waveCandyFile ? jsFiles.has(waveCandyFile) : false,
    includesScene: sceneFile ? jsFiles.has(sceneFile) : false,
    includesBirdsEyeRadar: birdsEyeRadarFile ? jsFiles.has(birdsEyeRadarFile) : false,
    includesAdvancedSoundDesignerStages: advancedSoundDesignerStagesFile
      ? jsFiles.has(advancedSoundDesignerStagesFile)
      : false,
    includesAudioControlPrimitives: audioControlPrimitivesFile
      ? jsFiles.has(audioControlPrimitivesFile)
      : false
  };
}

const routeClosures = routeEntries.map(({ route, entries }) => ({
  route,
  ...collectRouteClosure(entries)
}));
const deferredVisualClosures = {
  home: collectRouteClosure([
    'src/App.jsx',
    'src/components/Scene.jsx',
    'src/components/WaveCandy.jsx'
  ]),
  soundDesigner: collectRouteClosure([
    'src/pages/SoundDesignerPage.jsx',
    'src/components/WaveCandy.jsx'
  ])
};
const factoryPresetChunk = jsAssets.find(({ file }) => file.includes('factoryPresets')) || null;
const webMidiControllerChunk = jsAssets.find(({ file }) => file.includes('webMidiController')) || null;
const soundControlPanelChunk = jsAssets.find(({ file }) => file.includes('SoundTab')) || null;
const soundControlPanelCss = soundControlPanelCssFile
  ? assetMetricByFile.get(soundControlPanelCssFile) || null
  : null;
const midiParserChunk = jsAssets.find(({ file }) => file.includes('midiParser')) || null;
const fullSidebarChunk = fullSidebarFile ? assetMetricByFile.get(fullSidebarFile) || null : null;
const audioEngineChunk = audioEngineFile ? assetMetricByFile.get(audioEngineFile) || null : null;
const advancedSoundDesignerStagesChunk = advancedSoundDesignerStagesFile
  ? assetMetricByFile.get(advancedSoundDesignerStagesFile) || null
  : null;
const deferredWaveCandyCss = (waveCandyManifestRecord?.css || [])
  .map((file) => assetMetricByFile.get(file))
  .filter(Boolean);
const deferredBirdsEyeRadarCss = (birdsEyeRadarManifestRecord?.css || [])
  .map((file) => assetMetricByFile.get(file))
  .filter(Boolean);
const appManifestEntry = manifest['src/App.jsx'];
const appDefersMidiParser = appManifestEntry?.dynamicImports?.includes('src/utils/midiParser.js') || false;
const appDefersScene = appManifestEntry?.dynamicImports?.includes('src/components/Scene.jsx') || false;
const appDefersWaveCandy = appManifestEntry?.dynamicImports?.includes('src/components/WaveCandy.jsx') || false;
const generatedStudyManifestEntry = manifest['src/pages/GeneratedSongStudyPage.jsx'];
const generatedDefersSongStudyPlayer = (
  generatedStudyManifestEntry?.dynamicImports?.includes('src/pages/SongStudyPage.jsx') || false
);
const soundDesignerManifestEntry = manifest['src/pages/SoundDesignerPage.jsx'];
const songStudyManifestEntry = manifest['src/pages/SongStudyPage.jsx'];
const songStudyDefersMidiParser = (
  songStudyManifestEntry?.dynamicImports?.includes('src/utils/midiParser.js') || false
);
const songStudyDefersBirdsEyeRadar = (
  songStudyManifestEntry?.dynamicImports?.includes('src/components/BirdsEyeRadar.jsx') || false
);
const soundDesignerDefersWaveCandy = (
  soundDesignerManifestEntry?.dynamicImports?.includes('src/components/WaveCandy.jsx') || false
);
const soundDesignerDefersAdvancedStages = (
  soundDesignerManifestEntry?.dynamicImports?.includes('src/pages/SoundDesignerAdvancedStages.jsx') || false
);

const sourcePaths = (await walkFiles(sourceDir)).filter((file) => /\.(?:js|jsx)$/.test(file));
const sourceText = (await Promise.all(sourcePaths.map((file) => readFile(file, 'utf8')))).join('\n');
const productionSourcePaths = sourcePaths.filter((file) => !/\.(?:test|spec)\.[^.]+$/.test(file));
const productionSourceText = (await Promise.all(
  productionSourcePaths.map((file) => readFile(file, 'utf8'))
)).join('\n');
const sourceCssPaths = (await walkFiles(sourceDir)).filter((file) => file.endsWith('.css'));
const sourceCssText = (await Promise.all(sourceCssPaths.map((file) => readFile(file, 'utf8')))).join('\n');
const ownedCssAuditPaths = sourceCssPaths;
const ownedCssAuditText = (await Promise.all(
  ownedCssAuditPaths.map((file) => readFile(file, 'utf8'))
)).join('\n');
const dynamicallyComposedCssClasses = new Set([
  'kit-fader--horizontal',
  'kit-fader--vertical',
  'kit-numfield--align-center',
  'kit-numfield--align-left',
  'kit-numfield--align-right',
  'kit-numfield--bare',
  'kit-numfield--boxed',
  'kit-togglebtn--sm',
  'voice-loop-status--error',
  'voice-loop-status--ready',
  'voice-loop-status--warn',
  'voice-loop-status--working'
]);
const ownedCssClassNames = [...new Set(
  [...ownedCssAuditText.matchAll(/\.([_a-zA-Z]+[_a-zA-Z0-9-]*)/g)]
    .map((match) => match[1])
)];
const unreferencedOwnedCssClasses = ownedCssClassNames
  .filter((className) => (
    !productionSourceText.includes(className)
    && !dynamicallyComposedCssClasses.has(className)
  ));
const retiredPublicArtifacts = [
  'sw.js',
  path.join('assets', 'textures', 'retro-grid.svg'),
  path.join('assets', 'textures', 'skyline.svg')
].filter((file) => publicRelativePaths.includes(file));
const productionServiceWorkerRegistrationCalls = (
  productionSourceText.match(/serviceWorker\.register\s*\(/g) || []
).length;
const appHeaderSource = await readFile(path.join(sourceDir, 'components', 'AppHeader.jsx'), 'utf8');
const appHeaderImportsAudioEngine = /from\s+['"][^'"]*audioEngine(?:\.js)?['"]/.test(appHeaderSource);
const sidebarRailSource = await readFile(
  path.join(sourceDir, 'components', 'Sidebar', 'SidebarRail.jsx'),
  'utf8'
);
const sidebarSource = await readFile(
  path.join(sourceDir, 'components', 'Sidebar', 'index.jsx'),
  'utf8'
);
const sidebarIntentPrefetchImports = (
  sidebarRailSource.match(/import\s*\(\s*['"](?:\.\.\/\.\.\/App\.jsx|\.\.\/\.\.\/pages\/SoundDesignerPage\.jsx)['"]\s*\)/g)
  || []
).length;
const sidebarIntentPrefetchHandlers = (
  sidebarRailSource.match(/on(?:PointerEnter|Focus)=\{preload(?:Home|SoundDesigner)Route\}/g) || []
).length;
const sidebarEscapeListenerIsOpenOnly = /if\s*\(disabled\s*\|\|\s*!isOpen\)\s*return undefined;/.test(
  sidebarSource
);
const sidebarHiddenPanelsFreezeContext = (
  /const hiddenPanelPropsEqual = \(previous, next\) =>/.test(sidebarSource)
  && /!previous\.active && !next\.active/.test(sidebarSource)
  && /const MidiPanelBridge = \(\{ active \}\)/.test(sidebarSource)
  && /const SoundPanelBridge = \(\{ active \}\)/.test(sidebarSource)
  && /<MidiPanelBridge active=\{isOpen && !disabled\}/.test(sidebarSource)
  && /<SoundPanelBridge active=\{isOpen && !disabled\}/.test(sidebarSource)
  && /\(hasOpened \|\| isOpen\)/.test(sidebarSource)
);
const audioAnalysisPolicySource = await readFile(
  path.join(sourceDir, 'utils', 'audioAnalysisPolicy.js'),
  'utf8'
);
const waveCandyCanvasSource = await readFile(
  path.join(sourceDir, 'components', 'WaveCandyCanvas.jsx'),
  'utf8'
);
const waveCandyMeterGridSource = await readFile(
  path.join(sourceDir, 'utils', 'waveCandyMeterGrid.js'),
  'utf8'
);
const waveCandyDefersFrameLoopUntilGraph = (
  /audioEngine\.subscribe\s*\(startFrameLoopIfReady\)/.test(waveCandyCanvasSource)
  && /!audioEngine\.getAnalysisNodes\(\)\?\.analyser/.test(waveCandyCanvasSource)
);
const waveCandyDefersCanvasResourcesUntilGraph = (
  waveCandyCanvasSource.indexOf('!audioEngine.getAnalysisNodes()?.analyser')
  < waveCandyCanvasSource.indexOf("canvas.getContext('2d')")
  && waveCandyCanvasSource.indexOf('!audioEngine.getAnalysisNodes()?.analyser')
  < waveCandyCanvasSource.indexOf('createCanvasSizeController(canvas')
);
const waveCandyGradientCreationSites = (
  waveCandyCanvasSource.match(/\.createLinearGradient\s*\(/g) || []
).length;
const waveCandyResizeScopedGradientCaches = (
  waveCandyCanvasSource.match(/if\s*\(resized\s*\|\|\s*!gradientCache\.current\)/g) || []
).length;
const waveCandyCachesGradients = (
  waveCandyGradientCreationSites === 2
  && waveCandyResizeScopedGradientCaches === waveCandyGradientCreationSites
);
const waveCandyCachesSpectrumBinRanges = (
  (waveCandyCanvasSource.match(/createLogSpectrumBinRanges\s*\(/g) || []).length === 1
  && /buffers\.specBinSampleRate\s*!==\s*sampleRate/.test(waveCandyCanvasSource)
  && /buffers\.specBinFftSize\s*!==\s*analyser\.fftSize/.test(waveCandyCanvasSource)
  && /binRanges:\s*buffers\.specBinRanges/.test(waveCandyCanvasSource)
);
const waveCandyCachesSpectrogramRowsAndPalette = (
  (waveCandyCanvasSource.match(/createSpectrogramColorLut\s*\(/g) || []).length === 1
  && (waveCandyCanvasSource.match(/createSpectrogramRowRuns\s*\(/g) || []).length === 1
  && /renderCache\.rowRuns\[cell \* 2 \+ 1\]/.test(waveCandyCanvasSource)
);
const waveCandyCachesLagrangeEnvelopePlan = (
  (waveCandyCanvasSource.match(/createLagrangeEnvelopePlan\s*\(/g) || []).length === 1
  && /spectrumEnvelopePlanRef\.current/.test(waveCandyCanvasSource)
  && /sampleLagrangeEnvelope\s*\(/.test(waveCandyCanvasSource)
  && !/lagrangeEnvelope\s*\(/.test(waveCandyCanvasSource)
);
const waveCandyCachesStaticGridGeometry = (
  /const SPECTRUM_GRID_X_RATIOS = Float64Array\.from/.test(waveCandyCanvasSource)
  && /const SPECTRUM_GRID_DB_RATIOS = Float64Array\.from/.test(waveCandyCanvasSource)
  && /export const METER_GRID_RATIOS = Float64Array\.from/.test(waveCandyMeterGridSource)
  && /const traceSpectrumPath = \(ctx, data, width, height\)/.test(waveCandyCanvasSource)
  && /sizeControllers\.spectrogram\.acknowledgeResize\(\)/.test(waveCandyCanvasSource)
);
const waveCandyBatchesMeterGridPaths = (
  /drawWaveCandyMeterGrid\(ctx, width, height\)/.test(waveCandyCanvasSource)
  && (waveCandyMeterGridSource.match(/ctx\.beginPath\(\)/g) || []).length === 1
  && (waveCandyMeterGridSource.match(/ctx\.stroke\(\)/g) || []).length === 1
  && (waveCandyMeterGridSource.match(/ctx\.moveTo\(/g) || []).length === 5
  && (waveCandyMeterGridSource.match(/ctx\.lineTo\(/g) || []).length === 5
  && (waveCandyMeterGridSource.match(/ctx\.fillText\(/g) || []).length === 5
);
const waveCandyHoistsTraceScales = (
  /const xScale = cells > 1 \? width \/ \(cells - 1\) : 0/.test(waveCandyCanvasSource)
  && /const xScale = span > 1 \? width \/ \(span - 1\) : 0/.test(waveCandyCanvasSource)
  && (waveCandyCanvasSource.match(/const x = i \* xScale/g) || []).length === 2
  && !/const x = \(i \/ \((?:cells|span) - 1\)\) \* width/.test(waveCandyCanvasSource)
);
const waveCandyDecimatesScopeTrace = (
  /export const SCOPE_SAMPLES_PER_CSS_PIXEL = 2/.test(audioAnalysisPolicySource)
  && /export const getScopeTraceStride = \(sampleCount, cssWidth\)/.test(audioAnalysisPolicySource)
  && /const sampleStride = getScopeTraceStride\(span, width\)/.test(waveCandyCanvasSource)
  && /for \(let i = 0; i < span; i \+= sampleStride\)/.test(waveCandyCanvasSource)
  && /\(span - 1\) % sampleStride !== 0/.test(waveCandyCanvasSource)
);
const waveCandyDecimatesGoniometerTrace = (
  /export const GONIOMETER_POINTS_PER_CSS_PIXEL = 2/.test(audioAnalysisPolicySource)
  && /export const getGoniometerTraceStride = \(sampleCount, cssWidth, cssHeight\)/
    .test(audioAnalysisPolicySource)
  && /getGoniometerTraceStride\(\s*evaluatedPointCount,\s*width,\s*height\s*\)/
    .test(waveCandyCanvasSource)
  && /sampleCount === nextDrawSample/.test(waveCandyCanvasSource)
  && /nextDrawSample \+= traceStride/.test(waveCandyCanvasSource)
  && /lastDrawnIndex !== lastEvaluatedIndex/.test(waveCandyCanvasSource)
  && /if \(sampleCount === nextDrawSample\) \{[\s\S]*?\n    \}\n    sum \+= \(l \* l \+ r \* r\) \* 0\.5/
    .test(waveCandyCanvasSource)
);
const goniometerDesktopTraceStride = getGoniometerTraceStride(
  getStereoPairEvaluationsPerFrame(),
  230,
  150
);
const goniometerDesktopPointCount = (
  Math.floor((getStereoPairEvaluationsPerFrame() - 1) / goniometerDesktopTraceStride)
  + 1
  + Number((getStereoPairEvaluationsPerFrame() - 1) % goniometerDesktopTraceStride !== 0)
);
const birdsEyeRadarSource = await readFile(
  path.join(sourceDir, 'components', 'BirdsEyeRadar.jsx'),
  'utf8'
);
const radarPaletteSource = await readFile(
  path.join(sourceDir, 'utils', 'radarPalette.js'),
  'utf8'
);
const radarGradientCacheSource = await readFile(
  path.join(sourceDir, 'utils', 'radarGradientCache.js'),
  'utf8'
);
const radarParticleColorSource = await readFile(
  path.join(sourceDir, 'utils', 'radarParticleColor.js'),
  'utf8'
);
const radarUsesBoundedPaletteCache = (
  /getRadarMidiPalette\(note\.midi, isActive\)/.test(birdsEyeRadarSource)
  && /const paletteCache = new Map\(\)/.test(radarPaletteSource)
  && /normalizedMidi \* 2 \+ Number\(active\)/.test(radarPaletteSource)
);
const radarCachesStaticGradients = (
  /getRadarStaticGradients\(\s*ctx,\s*staticGradientCache,/.test(birdsEyeRadarSource)
  && /sizeController\.acknowledgeResize\(\)/.test(birdsEyeRadarSource)
  && /cache\.width === width && cache\.height === height/.test(radarGradientCacheSource)
  && (radarGradientCacheSource.match(/context\.create(?:Linear|Radial)Gradient\s*\(/g) || []).length === 4
);
const radarCachesParticleColors = (
  /getRadarParticleBatchColor\(bucket\)/.test(birdsEyeRadarSource)
  && /const particleColors = Array\.from\(/.test(radarParticleColorSource)
  && /const particleBatchColors = Array\.from\(/.test(radarParticleColorSource)
  && /RADAR_PARTICLE_COLOR_COUNT/.test(radarParticleColorSource)
);
const radarBatchesParticlePaths = (
  /RADAR_PARTICLE_ALPHA_BUCKET_COUNT = 12/.test(radarParticleColorSource)
  && /counts: new Uint8Array\(RADAR_PARTICLE_ALPHA_BUCKET_COUNT\)/
    .test(birdsEyeRadarSource)
  && /new Float64Array\(PARTICLE_COUNT \* 3\)/.test(birdsEyeRadarSource)
  && /pathBuckets\.counts\.fill\(0\)/.test(birdsEyeRadarSource)
  && /ctx\.moveTo\(x \+ size, y\)/.test(birdsEyeRadarSource)
  && /for \(let particleIndex = 0; particleIndex < count; particleIndex \+= 1\)/
    .test(birdsEyeRadarSource)
);
const radarLazilyInitializesParticleState = (
  /const particlesRef = useRef\(null\)/.test(birdsEyeRadarSource)
  && /if \(!particlesRef\.current\) particlesRef\.current = createParticles\(PARTICLE_COUNT\)/
    .test(birdsEyeRadarSource)
  && /const particlePathBucketsRef = useRef\(null\)/.test(birdsEyeRadarSource)
  && /particlePathBucketsRef\.current = createParticlePathBuckets\(\)/.test(birdsEyeRadarSource)
  && /const noteIdCacheRef = useRef\(null\)/.test(birdsEyeRadarSource)
  && /noteIdCacheRef\.current = new Map\(\)/.test(birdsEyeRadarSource)
  && /const propsRef = useRef\(null\)/.test(birdsEyeRadarSource)
  && !/useRef\(createParticles\(/.test(birdsEyeRadarSource)
  && !/useRef\(createParticlePathBuckets\(/.test(birdsEyeRadarSource)
  && !/useRef\(new Map\(\)\)/.test(birdsEyeRadarSource)
);
const midiBirdsEyeMathSource = await readFile(
  path.join(sourceDir, 'components', 'midiBirdsEyeMath.js'),
  'utf8'
);
const radarReusesFrameContainers = (
  /const visibleNoteRange = \{ startIndex: 0, endIndex: 0, windowStart: 0, windowEnd: 0 \}/
    .test(birdsEyeRadarSource)
  && /const activeLabelPositions = \[\]/.test(birdsEyeRadarSource)
  && /activeLabelPositions\.length = 0/.test(birdsEyeRadarSource)
  && /drawParticles\(nowSeconds, trackTop, trackBottom, centerX, playfieldWidth\)/
    .test(birdsEyeRadarSource)
  && /out\.startIndex = lowerBound/.test(midiBirdsEyeMathSource)
  && /return out;/.test(midiBirdsEyeMathSource)
);
const radarUsesAllocationFreeLabelCollision = (
  /for \(let labelIndex = 0; labelIndex < activeLabelPositions\.length; labelIndex \+= 1\)/
    .test(birdsEyeRadarSource)
  && /Math\.abs\(activeLabelPositions\[labelIndex\] - x\) <= 28/.test(birdsEyeRadarSource)
  && !/activeLabelPositions\.every\(/.test(birdsEyeRadarSource)
);
const sceneSource = await readFile(path.join(sourceDir, 'components', 'Scene.jsx'), 'utf8');
const sceneBandAnalysisSource = await readFile(
  path.join(sourceDir, 'utils', 'sceneBandAnalysis.js'),
  'utf8'
);
const sceneCachesBandRanges = (
  (sceneSource.match(/createSceneBandBinRanges\s*\(/g) || []).length === 1
  && /sceneBinSampleRate\s*!==\s*sampleRate/.test(sceneSource)
  && /sceneBinFftSize\s*!==\s*fftSize/.test(sceneSource)
  && /sceneBinCount\s*!==\s*freqData\.length/.test(sceneSource)
  && /sampleSceneBandEnergies\(freqData, sceneBinRanges, sceneBandEnergies\)/.test(sceneSource)
  && /new Uint16Array\(frequencyBands\.length \* 2\)/.test(sceneBandAnalysisSource)
);
const sceneReusesDebugState = (
  /const sceneDebug = \{ vortexCount: 0, pulse: 0, level: 0 \}/.test(sceneSource)
  && /sceneDebug\.vortexCount = vortices\.particles\.length/.test(sceneSource)
  && /sceneDebug\['pulse'\] = pulse/.test(sceneSource)
  && /sceneDebug\.level = level/.test(sceneSource)
  && !/window\.__sceneDebug = \{/.test(sceneSource)
);
const vizPhysicsSource = await readFile(path.join(sourceDir, 'utils', 'vizPhysics.js'), 'utf8');
const vortexFieldReusesFrameStorage = (
  /this\.inducedU = new Float64Array\(maxParticles\)/.test(vizPhysicsSource)
  && /this\.inducedV = new Float64Array\(maxParticles\)/.test(vizPhysicsSource)
  && /this\.uniformSelection = new Array\(maxParticles\)/.test(vizPhysicsSource)
  && /particles\.length = survivorCount/.test(vizPhysicsSource)
  && /sorted\[i\] = undefined/.test(vizPhysicsSource)
  && !/this\.particles\.map\(\(p\) => this\.velocityAt/.test(vizPhysicsSource)
  && !/this\.particles = this\.particles\.filter/.test(vizPhysicsSource)
  && !/const sorted = \[\.\.\.this\.particles\]/.test(vizPhysicsSource)
);
const audioEngineGatewaySource = await readFile(path.join(sourceDir, 'utils', 'audioEngine.js'), 'utf8');
const webMidiControllerSource = await readFile(path.join(sourceDir, 'utils', 'webMidiController.js'), 'utf8');
const audioGatewayDefersRuntime = /import\s*\(\s*['"]\.\/audioEngineRuntime\.js['"]\s*\)/
  .test(audioEngineGatewaySource);
const hardwareMidiReadinessCalls = (
  webMidiControllerSource.match(/audioEngine\.ensureWasm\s*\(/g) || []
).length;
const playableRouteSource = (await Promise.all([
  'App.jsx',
  path.join('pages', 'SoundDesignerPage.jsx'),
  path.join('pages', 'SongStudyPage.jsx')
].map((file) => readFile(path.join(sourceDir, file), 'utf8')))).join('\n');
const eagerPlayableRouteAudioWarmupCalls = (
  playableRouteSource.match(/audioEngine\.(?:ensureWasm|ensureAudioContext|warmGraph)\s*\(/g) || []
).length;
const deferredAudioWarmupConsumers = (
  playableRouteSource.match(/useAudioEngineWarmup\s*\(\s*\)/g) || []
).length;
const deferredVisualMountConsumers = (
  playableRouteSource.match(/useDeferredVisualMount\s*\(/g) || []
).length;
const eagerMutableHookInitializers = (
  productionSourceText.match(
    /(?:React\.)?use(?:Ref|State)\(\s*(?:new\s+(?:Map|Set|VerletChain)\s*\(|loadAppSession\s*\(\s*\)|\{|\[)/g
  ) || []
).length;
const appLoadsSessionOnce = (
  /const \[initialSession\] = useState\(loadAppSession\)/.test(productionSourceText)
  && !/useRef\(loadAppSession\(\)\)/.test(productionSourceText)
);
const midiPlaybackSource = await readFile(
  path.join(sourceDir, 'hooks', 'useMidiPlayback.js'),
  'utf8'
);
const midiSchedulerAvoidsWholeScoreQueue = (
  !/const pendingNotes = notes\s*\.map\(/.test(midiPlaybackSource)
  && /notes\[nextIndex\]\.time \+ notes\[nextIndex\]\.duration <= offset/
    .test(midiPlaybackSource)
  && /const note = notes\[nextIndex\]/.test(midiPlaybackSource)
  && /const index = nextIndex/.test(midiPlaybackSource)
);
const midiPlaybackNotesSource = await readFile(
  path.join(sourceDir, 'utils', 'midiPlaybackNotes.js'),
  'utf8'
);
const midiNormalizerUsesOnePassFastPath = (
  /const normalizedNotes = \[\]/.test(midiPlaybackNotesSource)
  && /for \(let index = 0; index < notes\.length; index \+= 1\)/
    .test(midiPlaybackNotesSource)
  && /normalizedNotes\.push\(\{/.test(midiPlaybackNotesSource)
  && /if \(!isSorted\) normalizedNotes\.sort\(/.test(midiPlaybackNotesSource)
  && !/notes\s*\.map\(/.test(midiPlaybackNotesSource)
  && !/\.filter\(Boolean\)/.test(midiPlaybackNotesSource)
);
const pipelineJobStateSource = await readFile(
  path.join(sourceDir, 'utils', 'pipelineJobState.js'),
  'utf8'
);
const pipelinePollingSource = (await Promise.all([
  path.join('pages', 'MidiPipelinePage.jsx'),
  path.join('pages', 'GeneratedSongStudyPage.jsx'),
  path.join('pages', 'StudySongsPage.jsx')
].map((file) => readFile(path.join(sourceDir, file), 'utf8')))).join('\n');
const pipelinePollingReusesJobSnapshots = (
  (pipelinePollingSource.match(/reusePipelineJob(?:List)?\(/g) || []).length === 3
  && /job\.updated_at !== null/.test(pipelineJobStateSource)
  && /currentJob\.id === nextJob\.id/.test(pipelineJobStateSource)
  && /currentJob\.updated_at === nextJob\.updated_at/.test(pipelineJobStateSource)
  && /if \(currentJobs\.length !== nextJobs\.length\) return false/.test(pipelineJobStateSource)
);
const voiceLoopSource = await readFile(
  path.join(sourceDir, 'pages', 'VoiceLoopLabPage.jsx'),
  'utf8'
);
const songStudySource = await readFile(
  path.join(sourceDir, 'pages', 'SongStudyPage.jsx'),
  'utf8'
);
const voiceLoopDefersScoreRenderUntilInteraction = (
  /const renderInputRevisionRef = React\.useRef\(0\)/.test(voiceLoopSource)
  && /const renderedRevisionRef = React\.useRef\(-1\)/.test(voiceLoopSource)
  && /renderedRevisionRef\.current = renderRevision/.test(voiceLoopSource)
  && /!isPlaying\s*\|\|\s*renderedRevisionRef\.current === renderInputRevisionRef\.current/
    .test(voiceLoopSource)
  && /const timeoutId = window\.setTimeout\(async \(\) =>/.test(voiceLoopSource)
  && /\}, 260\)/.test(voiceLoopSource)
);
const voiceLoopUsesTargetedPlayheadFeedback = (
  !/setPlayhead/.test(voiceLoopSource)
  && /const scoreGridRef = React\.useRef\(null\)/.test(voiceLoopSource)
  && /const activeEventIndexRef = React\.useRef\(-1\)/.test(voiceLoopSource)
  && /classList\.remove\('is-active'\)/.test(voiceLoopSource)
  && /classList\.add\('is-active'\)/.test(voiceLoopSource)
  && /setAttribute\('aria-current', 'true'\)/.test(voiceLoopSource)
  && /ref=\{scoreGridRef\}/.test(voiceLoopSource)
  && /startVisibilityAwareRafLoop/.test(voiceLoopSource)
);
const voiceLoopContinuousRangesCoalesceByFrame = (
  /const pendingContinuousFormRef = React\.useRef\(null\)/.test(voiceLoopSource)
  && /const pendingContinuousControlsRef = React\.useRef\(null\)/.test(voiceLoopSource)
  && /requestAnimationFrame\(flushContinuousChanges\)/.test(voiceLoopSource)
  && /onChange=\{queueContinuousChange\}/.test(voiceLoopSource)
  && /\.\.\.continuousRangeFlushProps/.test(voiceLoopSource)
  && /cancelAnimationFrame\(continuousChangeFrameRef\.current\)/.test(voiceLoopSource)
  && !/const handleControlChange =/.test(voiceLoopSource)
);
const songStudyPointerScrubDefersEngineSeek = (
  /const \[scrubPreviewTime, setScrubPreviewTime\] = React\.useState\(null\)/.test(songStudySource)
  && /const pendingScrubTimeRef = React\.useRef\(null\)/.test(songStudySource)
  && /requestAnimationFrame\(flushScrubPreview\)/.test(songStudySource)
  && /\|\| scrubPreviewTime !== null/.test(songStudySource)
  && /if \(!pointerScrubbingRef\.current\) \{\s*seekToTime\(nextTime\)/.test(songStudySource)
  && /const finalTime = pendingTime \?\? previewTime \?\? targetTime/.test(songStudySource)
  && /seekToTime\(finalTime\)/.test(songStudySource)
  && /onPointerUp=\{handleScrubPointerEnd\}/.test(songStudySource)
  && /cancelAnimationFrame\(scrubFrameRef\.current\)/.test(songStudySource)
);
const songStudyTitleFitCoalescesByFrame = (
  /let lastContainerWidth = -1/.test(songStudySource)
  && /new ResizeObserver\(\(\) => scheduleFit\(false\)\)/.test(songStudySource)
  && /resizeFrame = window\.requestAnimationFrame\(flushFit\)/.test(songStudySource)
  && /if \(!force && containerWidth === lastContainerWidth\) return/.test(songStudySource)
  && /else \{\s*window\.addEventListener\('resize', handleWindowResize\)/.test(songStudySource)
  && /document\.fonts\?\.ready\?\.then\(\(\) => scheduleFit\(true\)\)/.test(songStudySource)
  && /window\.cancelAnimationFrame\(resizeFrame\)/.test(songStudySource)
  && /if \(disposed\) return/.test(songStudySource)
);
const keyboardNotePlaybackSource = await readFile(
  path.join(sourceDir, 'components', 'SynthKeyboard', 'hooks', 'useNotePlayback.js'),
  'utf8'
);
const keyboardVisualFeedbackSource = await readFile(
  path.join(sourceDir, 'components', 'SynthKeyboard', 'hooks', 'useVisualFeedback.js'),
  'utf8'
);
const keyboardAvoidsUnobservedInteractionWork = (
  !/updateVelocityDisplay/.test(keyboardNotePlaybackSource)
  && !/updateVelocityDisplay/.test(keyboardVisualFeedbackSource)
  && !/useState/.test(keyboardVisualFeedbackSource)
  && !/PerformanceObserver/.test(keyboardNotePlaybackSource)
  && /window\.__vangelisPerf/.test(keyboardNotePlaybackSource)
  && /scheduleVisualUpdate\(noteMeta\.noteId, true\)/.test(keyboardNotePlaybackSource)
);
const keyboardPointerInputSource = await readFile(
  path.join(sourceDir, 'components', 'SynthKeyboard', 'hooks', 'usePointerInput.js'),
  'utf8'
);
const keyboardCoalescesPointerMovesByFrame = (
  /const pendingMoves = new Map\(\)/.test(keyboardPointerInputSource)
  && /moveFrameId = requestAnimationFrame\(flushPointerMoves\)/.test(keyboardPointerInputSource)
  && /pendingMove\.clientX = event\.clientX/.test(keyboardPointerInputSource)
  && /keyElement\.dataset\.note === pointerToNoteRef\.current\.get\(pointerId\)/
    .test(keyboardPointerInputSource)
  && /addEventListener\('pointermove', pointerMove, \{ passive: true \}\)/
    .test(keyboardPointerInputSource)
  && /cancelAnimationFrame\(moveFrameId\)/.test(keyboardPointerInputSource)
);
const synthKeyboardSource = await readFile(
  path.join(sourceDir, 'components', 'SynthKeyboard', 'index.jsx'),
  'utf8'
);
const sharedVisualRenderIsolation = (
  /const EMPTY_ACTIVE_NOTES = new Set\(\)/.test(synthKeyboardSource)
  && /const whiteKeyElements = useMemo\(\(\) =>/.test(synthKeyboardSource)
  && /const blackKeyElements = useMemo\(\(\) =>/.test(synthKeyboardSource)
  && /const whiteKeyGridStyle = useMemo\(\(\) =>/.test(synthKeyboardSource)
  && /if \(!propsRef\.current\) propsRef\.current = \{\}/.test(birdsEyeRadarSource)
  && /propsRef\.current\.noteRenderWindow = noteRenderWindow/.test(birdsEyeRadarSource)
  && /export default React\.memo\(BirdsEyeRadar\)/.test(birdsEyeRadarSource)
);
const valueSliderSource = await readFile(
  path.join(sourceDir, 'components', 'controls', 'ValueSlider.jsx'),
  'utf8'
);
const valueSliderCoalescesPointerMovesByFrame = (
  /const pendingPointerXRef = useRef\(null\)/.test(valueSliderSource)
  && /const pointerMoveFrameRef = useRef\(null\)/.test(valueSliderSource)
  && /requestAnimationFrame\(flushPointerMove\)/.test(valueSliderSource)
  && /commit\(valueFromPointer\(pendingClientX\)\)/.test(valueSliderSource)
  && /useEffect\(\(\) => cancelPendingPointerMove/.test(valueSliderSource)
  && /cancelAnimationFrame\(pointerMoveFrameRef\.current\)/.test(valueSliderSource)
);
const effectMacroDialSource = await readFile(
  path.join(sourceDir, 'components', 'EffectMacroDial.jsx'),
  'utf8'
);
const controlKitDragSource = await readFile(
  path.join(sourceDir, 'components', 'controls', 'kit', 'useDragValue.js'),
  'utf8'
);
const remainingContinuousControlsCoalesceByFrame = (
  /const pendingClientYRef = useRef\(null\)/.test(effectMacroDialSource)
  && /requestAnimationFrame\(flushPointerMove\)/.test(effectMacroDialSource)
  && /updateFromDelta\(pendingClientY\)/.test(effectMacroDialSource)
  && /useEffect\(\(\) => cancelPendingPointerMove/.test(effectMacroDialSource)
  && /const pendingPositionRef = useRef\(null\)/.test(controlKitDragSource)
  && /requestAnimationFrame\(flushPointerMove\)/.test(controlKitDragSource)
  && /commitPointerPosition\(pendingPosition, pendingFine\)/.test(controlKitDragSource)
  && /useEffect\(\(\) => cancelPendingPointerMove/.test(controlKitDragSource)
);
const [controlKitPageSource, knobSource, faderSource, numFieldSource, toggleBtnSource, segmentSelectSource] = await Promise.all([
  readFile(path.join(sourceDir, 'pages', 'ControlKitPage.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'controls', 'kit', 'Knob.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'controls', 'kit', 'Fader.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'controls', 'kit', 'NumField.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'controls', 'kit', 'ToggleBtn.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'controls', 'kit', 'SegmentSelect.jsx'), 'utf8')
]);
const [soundDesignerSource, soundDesignerAdvancedSource, presetShelfSource] = await Promise.all([
  readFile(path.join(sourceDir, 'pages', 'SoundDesignerPage.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'pages', 'SoundDesignerAdvancedStages.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'components', 'PresetShelf.jsx'), 'utf8')
]);
const [appSource, audioEngineRuntimeSource, audioEngineEffectsSource, trailingDeadlineSchedulerSource] = await Promise.all([
  readFile(path.join(sourceDir, 'App.jsx'), 'utf8'),
  readFile(path.join(sourceDir, 'utils', 'audioEngineRuntime.js'), 'utf8'),
  readFile(path.join(sourceDir, 'utils', 'audioEngine', 'effects.js'), 'utf8'),
  readFile(path.join(sourceDir, 'utils', 'trailingDeadlineScheduler.js'), 'utf8')
]);
const controlKitPrimitivesIsolateRenders = (
  [knobSource, faderSource, numFieldSource, toggleBtnSource, segmentSelectSource]
    .every((componentSource) => /export default React\.memo\(/.test(componentSource))
  && /const STATIC_TICKS_BY_SIZE =/.test(knobSource)
  && /const tickElements = useMemo\(\(\) =>/.test(faderSource)
  && /const faderTrioSetters = useMemo\(\(\) =>/.test(controlKitPageSource)
  && !/format=\{\(/.test(controlKitPageSource)
  && !/onChange=\{\(next\)/.test(controlKitPageSource)
);
const presetShelfPropsSource = soundDesignerSource.match(
  /const presetShelfProps = React\.useMemo\([\s\S]*?\}\), \[activePresetName, handlePresetApplied\]\);/
)?.[0] || '';
const soundDesignerBaseStageIsolatesParamRenders = (
  /const StageFooterNav = React\.memo\(/.test(soundDesignerSource)
  && /const BaseStage = React\.memo\(/.test(soundDesignerSource)
  && presetShelfPropsSource.length > 0
  && !/(waveformType|audioParams)/.test(presetShelfPropsSource)
  && /export default React\.memo\(PresetShelf\)/.test(presetShelfSource)
);
const soundDesignerAdvancedControlsIsolateRenders = (
  /const AudioParamSlider = React\.memo\(/.test(soundDesignerAdvancedSource)
  && /const handleChange = React\.useCallback\(\(value\) =>/.test(soundDesignerAdvancedSource)
  && /const StageFooterNav = React\.memo\(/.test(soundDesignerAdvancedSource)
  && /const areModRoutesEqual =/.test(soundDesignerAdvancedSource)
  && /const ModRoutesEditor = React\.memo\(/.test(soundDesignerAdvancedSource)
  && /areModRoutesEqual\(previousProps\.routes, nextProps\.routes\)/.test(soundDesignerAdvancedSource)
);
const normalizedGlobalParamsAvoidDuplicateSanitize = (
  /this\.pendingParamsAreSanitized = false/.test(audioEngineGatewaySource)
  && /setSanitizedGlobalParams\(params\)/.test(audioEngineGatewaySource)
  && /runtime\.setSanitizedGlobalParams\(this\.pendingParams\)/.test(audioEngineGatewaySource)
  && /setSanitizedGlobalParams\(params\) \{\s*this\.applyGlobalParams\(params\);/s.test(audioEngineRuntimeSource)
  && /audioEngine\.setSanitizedGlobalParams\(audioParams\)/.test(appSource)
  && /audioEngine\.setSanitizedGlobalParams\(audioParams\)/.test(soundDesignerSource)
  && /setGlobalParams\(params\) \{\s*this\.applyGlobalParams\(sanitizeAudioParams\(params\)\);/s.test(audioEngineRuntimeSource)
);
const audioParamChangeDetectionAvoidsSignatureSerialization = (
  /const AUDIO_PARAM_COMPARISON_KEYS = Object\.keys\(AUDIO_PARAM_DEFAULTS\)/.test(audioEngineEffectsSource)
  && /export function areAudioParamsEqual\(/.test(audioEngineEffectsSource)
  && /previousRoute\.src !== nextRoute\.src/.test(audioEngineEffectsSource)
  && /areAudioParamsEqual\(this\.currentParams, effective\)/.test(audioEngineRuntimeSource)
  && /this\.lastParamSignature = 'applied'/.test(audioEngineRuntimeSource)
  && !/paramsSignature\(effective\)/.test(audioEngineRuntimeSource)
);
const homeSessionPersistenceUsesDeadlineScheduler = (
  /deadline = now\(\) \+ delayMs/.test(trailingDeadlineSchedulerSource)
  && /if \(timeoutId === null\)/.test(trailingDeadlineSchedulerSource)
  && /Math\.ceil\(remaining\)/.test(trailingDeadlineSchedulerSource)
  && /createTrailingDeadlineScheduler\(\{/.test(appSource)
  && /sessionSaveSchedulerRef\.current\.schedule\(\)/.test(appSource)
  && /sessionSaveSchedulerRef\.current\.cancel\(\)/.test(appSource)
  && !/sessionSaveTimeoutRef/.test(appSource)
);
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
const tailwindBuildDependencies = ['tailwindcss']
  .filter((dependency) => packageJson.devDependencies?.[dependency]);
const criticalGlobalCssSelectors = [
  '.app-stage',
  '.app-shell',
  '.button-primary',
  '.value-slider',
  '.wave-candy-placeholder',
  '.panel',
  '.preset-shelf',
  '.route-loading'
];
const missingCriticalGlobalCssSelectors = criticalGlobalCssSelectors
  .filter((selector) => !initialCssText.includes(selector));

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
    deferredSoundControlPanelCss: soundControlPanelCss ? {
      file: soundControlPanelCss.file,
      kb: roundKb(soundControlPanelCss.bytes),
      gzipKb: roundKb(soundControlPanelCss.gzipBytes)
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
    deferredSoundDesignerAdvancedStagesChunk: advancedSoundDesignerStagesChunk ? {
      file: advancedSoundDesignerStagesChunk.file,
      kb: roundKb(advancedSoundDesignerStagesChunk.bytes),
      gzipKb: roundKb(advancedSoundDesignerStagesChunk.gzipBytes)
    } : null,
    deferredWaveCandyCss: {
      assetCount: deferredWaveCandyCss.length,
      kb: roundKb(sum(deferredWaveCandyCss, 'bytes')),
      gzipKb: roundKb(sum(deferredWaveCandyCss, 'gzipBytes'))
    },
    deferredBirdsEyeRadarCss: {
      assetCount: deferredBirdsEyeRadarCss.length,
      kb: roundKb(sum(deferredBirdsEyeRadarCss, 'bytes')),
      gzipKb: roundKb(sum(deferredBirdsEyeRadarCss, 'gzipBytes'))
    },
    deferredKeyboardCss: keyboardCssAsset ? {
      file: keyboardCssAsset.file,
      kb: roundKb(keyboardCssAsset.bytes),
      gzipKb: roundKb(keyboardCssAsset.gzipBytes)
    } : null,
    homeOverlayCss: homeOverlayCssAsset ? {
      file: homeOverlayCssAsset.file,
      kb: roundKb(homeOverlayCssAsset.bytes),
      gzipKb: roundKb(homeOverlayCssAsset.gzipBytes)
    } : null,
    appDefersMidiParser,
    appDefersScene,
    appDefersWaveCandy,
    generatedDefersSongStudyPlayer,
    songStudyDefersMidiParser,
    songStudyDefersBirdsEyeRadar,
    soundDesignerDefersWaveCandy,
    soundDesignerDefersAdvancedStages,
    deferredVisualClosures,
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
    tailwindDirectiveCount: countCss(/@tailwind\b/g),
    generatedTailwindVariableCount: (initialCssText.match(/--tw-/g) || []).length,
    criticalGlobalCssSelectorCount: criticalGlobalCssSelectors.length,
    missingCriticalGlobalCssSelectors,
    retiredOverlaySelectorCount: countCss(/\.(?:command-palette|brandkit-)/g),
    ownedCssAuditFileCount: ownedCssAuditPaths.length,
    ownedCssClassCount: ownedCssClassNames.length,
    dynamicallyComposedCssClassCount: dynamicallyComposedCssClasses.size,
    unreferencedOwnedCssClasses,
    retiredPublicArtifacts,
    productionServiceWorkerRegistrationCalls,
    sidebarIntentPrefetchImports,
    sidebarIntentPrefetchHandlers,
    sidebarEscapeListenerIsOpenOnly,
    hiddenSoundPanelExpensiveRendersPerClosedContextUpdate:
      sidebarHiddenPanelsFreezeContext ? 0 : 5,
    hiddenMidiPanelExpensiveRendersPerClosedProgressUpdate:
      sidebarHiddenPanelsFreezeContext ? 0 : 3,
    hiddenPanelContextBridgeRendersPerClosedUpdate: 1,
    sidebarHiddenPanelsFreezeContext,
    sceneActiveFrameRateHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
    sceneIdleFrameRateHz: 1000 / SCENE_IDLE_FRAME_INTERVAL_MS,
    sceneFrequencyBoundaryEvaluationsPerSteadyStateFrame: sceneCachesBandRanges ? 0 : 22,
    sceneCachesBandRanges,
    sceneDebugObjectAllocationsPerSteadyStateFrame: sceneReusesDebugState ? 0 : 1,
    sceneReusesDebugState,
    sceneVortexVelocityObjectAllocationsPerSteadyStateFrame:
      vortexFieldReusesFrameStorage ? 0 : 12,
    sceneVortexArrayAllocationsPerSteadyStateFrame: vortexFieldReusesFrameStorage ? 0 : 4,
    vortexFieldReusesFrameStorage,
    waveCandyColdFrameRateHz: waveCandyDefersFrameLoopUntilGraph ? 0 : 30,
    waveCandyDefersFrameLoopUntilGraph,
    waveCandyColdCanvasContextCount: waveCandyDefersCanvasResourcesUntilGraph ? 0 : 5,
    waveCandyColdResizeObserverCount: waveCandyDefersCanvasResourcesUntilGraph ? 0 : 5,
    waveCandyDefersCanvasResourcesUntilGraph,
    waveCandyGradientCreationSites,
    waveCandySteadyStateGradientAllocationsPerFrame: waveCandyCachesGradients ? 0 : 2,
    waveCandyCachesGradients,
    waveCandySpectrumBoundaryEvaluationsPerFrame: waveCandyCachesSpectrumBinRanges ? 0 : 192,
    waveCandyCachesSpectrumBinRanges,
    waveCandySteadyStateSpectrogramColorStringAllocationsPerFrame:
      waveCandyCachesSpectrogramRowsAndPalette ? 0 : 150,
    waveCandyDesktopSpectrogramFillCallsPerFrame:
      waveCandyCachesSpectrogramRowsAndPalette ? 96 : 150,
    waveCandyCachesSpectrogramRowsAndPalette,
    waveCandyLagrangeFrameAllocations: waveCandyCachesLagrangeEnvelopePlan ? 0 : 4,
    waveCandyCachesLagrangeEnvelopePlan,
    waveCandyStaticGridFrameTemporaries: waveCandyCachesStaticGridGeometry ? 0 : 6,
    waveCandyCachesStaticGridGeometry,
    waveCandyMeterGridBeginPathCallsPerFrame: waveCandyBatchesMeterGridPaths ? 1 : 5,
    waveCandyMeterGridStrokeCallsPerFrame: waveCandyBatchesMeterGridPaths ? 1 : 5,
    waveCandyBatchesMeterGridPaths,
    waveCandyTracePointDivisionsPerFrameMaximum: waveCandyHoistsTraceScales ? 0 : 1312,
    waveCandyTraceScaleDivisionsPerFrame: waveCandyHoistsTraceScales ? 4 : 0,
    waveCandyHoistsTraceScales,
    waveCandyScopeSamplesPerCssPixelLimit: waveCandyDecimatesScopeTrace ? 2 : null,
    waveCandyScopePointMaximumAt330CssPixels: waveCandyDecimatesScopeTrace ? 660 : 1024,
    waveCandyDecimatesScopeTrace,
    waveCandyGoniometerPointsPerCssPixelLimit:
      waveCandyDecimatesGoniometerTrace ? GONIOMETER_POINTS_PER_CSS_PIXEL : null,
    waveCandyGoniometerTraceStrideAt230x150:
      waveCandyDecimatesGoniometerTrace ? goniometerDesktopTraceStride : 1,
    waveCandyGoniometerPointsPerFrameAt230x150:
      waveCandyDecimatesGoniometerTrace
        ? goniometerDesktopPointCount
        : getStereoPairEvaluationsPerFrame(),
    waveCandyGoniometerMeterEvaluationsPerFrame: getStereoPairEvaluationsPerFrame(),
    waveCandyDecimatesGoniometerTrace,
    radarPaletteConstructionsPerSteadyStateNote: radarUsesBoundedPaletteCache ? 0 : 1,
    radarPaletteStateLimit: 256,
    radarUsesBoundedPaletteCache,
    radarStaticGradientCreationsPerSteadyStateFrame: radarCachesStaticGradients ? 0 : 4,
    radarCachesStaticGradients,
    radarParticleColorStringAllocationsPerSteadyStateFrame:
      radarCachesParticleColors ? 0 : 32,
    radarParticleColorStateLimit: 121,
    radarCachesParticleColors,
    radarParticleAlphaBucketCount: 12,
    radarParticlePathBoundaryCallsPerFrameMaximum: radarBatchesParticlePaths ? 24 : 64,
    radarParticleTotalPathCommandsPerFrameMaximum: radarBatchesParticlePaths ? 88 : 96,
    radarBatchesParticlePaths,
    radarRedundantInitializationAllocationsPerReactRender:
      radarLazilyInitializesParticleState ? 0 : 35,
    radarLazilyInitializesParticleState,
    radarExplicitFrameContainers: radarReusesFrameContainers ? 0 : 8,
    radarReusesFrameContainers,
    radarLabelCollisionCallbackAllocationsPerCheck:
      radarUsesAllocationFreeLabelCollision ? 0 : 1,
    radarUsesAllocationFreeLabelCollision,
    waveCandyActiveFrameRateHz: 1000 / WAVE_CANDY_FRAME_INTERVAL_MS,
    waveCandyMonoFftSize: MONO_ANALYSER_FFT_SIZE,
    waveCandyStereoFftSize: STEREO_ANALYSER_FFT_SIZE,
    waveCandyStereoVisualSampleStride: STEREO_VISUAL_SAMPLE_STRIDE,
    waveCandySamplesPerFrame: getWaveCandySamplesPerFrame(),
    waveCandyStereoPairEvaluationsPerFrame: getStereoPairEvaluationsPerFrame(),
    canvasElements: count(/<canvas\b/g),
    webglContextRequests: count(/getContext\s*\(\s*['"]webgl2?['"]/g),
    wasmModuleImports: count(/(?:from\s+['"][^'"]*\.wasm(?:\?[^'"]*)?['"]|import\s*\(\s*['"][^'"]*\.wasm)/g),
    appHeaderImportsAudioEngine,
    audioGatewayDefersRuntime,
    audioEngineRuntimeIsDynamicEntry: audioEngineRuntimeManifestRecord?.isDynamicEntry === true,
    hardwareMidiReadinessCalls,
    eagerPlayableRouteAudioWarmupCalls,
    deferredAudioWarmupConsumers,
    deferredVisualMountConsumers,
    productionEagerMutableHookInitializers: eagerMutableHookInitializers,
    hotPlaybackRedundantContainerAllocationsPerRender:
      eagerMutableHookInitializers === 0 ? 0 : 14,
    appSessionStorageReadsPerReactRender: appLoadsSessionOnce ? 0 : 1,
    appSessionStorageReadsPerMount: 1,
    appLoadsSessionOnce,
    midiSchedulerWrapperAllocationsPer10000NoteSchedule:
      midiSchedulerAvoidsWholeScoreQueue ? 0 : 10000,
    midiSchedulerQueueArrayAllocationsPerSchedule:
      midiSchedulerAvoidsWholeScoreQueue ? 0 : 2,
    midiSchedulerAvoidsWholeScoreQueue,
    midiNormalizerArraysPerImport: midiNormalizerUsesOnePassFastPath ? 1 : 2,
    midiNormalizerSortedInputSortCalls: midiNormalizerUsesOnePassFastPath ? 0 : 1,
    midiNormalizerUsesOnePassFastPath,
    unchangedPipelinePollReactCommits: pipelinePollingReusesJobSnapshots ? 0 : 1,
    pipelinePollingReusesJobSnapshots,
    voiceLoopColdAudioContextConstructions:
      voiceLoopDefersScoreRenderUntilInteraction ? 0 : 1,
    voiceLoopColdScoreRenders: voiceLoopDefersScoreRenderUntilInteraction ? 0 : 1,
    voiceLoopDefersScoreRenderUntilInteraction,
    voiceLoopPlayheadReactCommitsPerTick:
      voiceLoopUsesTargetedPlayheadFeedback ? 0 : 1,
    voiceLoopPlayheadMaximumEventRowReconciliationsPerTick:
      voiceLoopUsesTargetedPlayheadFeedback ? 0 : 192,
    voiceLoopUsesTargetedPlayheadFeedback,
    voiceLoopRangeStateUpdatesPer240HzFrame:
      voiceLoopContinuousRangesCoalesceByFrame ? 1 : 4,
    voiceLoopRangeStateObjectClonesPer240HzFrame:
      voiceLoopContinuousRangesCoalesceByFrame ? 1 : 4,
    voiceLoopContinuousRangesCoalesceByFrame,
    songStudyScrubPreviewUpdatesPer240HzFrame:
      songStudyPointerScrubDefersEngineSeek ? 1 : 4,
    songStudySchedulerRebuildsPerPointerScrub:
      songStudyPointerScrubDefersEngineSeek ? 1 : 2400,
    songStudyPointerScrubDefersEngineSeek,
    songStudyTitleFitCallsPer240HzResizeFrame:
      songStudyTitleFitCoalescesByFrame ? 1 : 5,
    songStudyTitleResizeSourcesWithObserver:
      songStudyTitleFitCoalescesByFrame ? 1 : 2,
    songStudyTitleFitCoalescesByFrame,
    keyboardVelocityStateUpdatesPerNote: keyboardAvoidsUnobservedInteractionWork ? 0 : 1,
    keyboardVelocityOnlyReactCommitsPerFrame:
      keyboardAvoidsUnobservedInteractionWork ? 0 : 1,
    keyboardNoteTimingSamplesPerUnprofiledNote:
      keyboardAvoidsUnobservedInteractionWork ? 0 : 2,
    keyboardLocalLongTaskObserversPerMount:
      keyboardAvoidsUnobservedInteractionWork ? 0 : 1,
    keyboardAvoidsUnobservedInteractionWork,
    keyboardPointerDomHitTestsPer240HzFrame:
      keyboardCoalescesPointerMovesByFrame ? 1 : 4,
    keyboardPointerMoveListenerPassive: keyboardCoalescesPointerMovesByFrame,
    keyboardCoalescesPointerMovesByFrame,
    keyboardKeyElementAllocationsPerAudioParamFrame:
      sharedVisualRenderIsolation ? 0 : 18,
    keyboardActiveNoteMembershipChecksPerAudioParamFrame:
      sharedVisualRenderIsolation ? 0 : 18,
    keyboardGridStyleObjectsPerAudioParamFrame:
      sharedVisualRenderIsolation ? 0 : 1,
    radarPropsSnapshotObjectsPerReactRender:
      sharedVisualRenderIsolation ? 0 : 1,
    radarUnchangedParentRendersPerUpdate:
      sharedVisualRenderIsolation ? 0 : 1,
    sharedVisualRenderIsolation,
    valueSliderLayoutReadsPer240HzFrame:
      valueSliderCoalescesPointerMovesByFrame ? 1 : 4,
    valueSliderParentUpdatesPer240HzFrame:
      valueSliderCoalescesPointerMovesByFrame ? 1 : 4,
    valueSliderCoalescesPointerMovesByFrame,
    effectMacroDialParentUpdatesPer240HzFrame:
      remainingContinuousControlsCoalesceByFrame ? 1 : 4,
    controlKitDragParentUpdatesPer240HzFrame:
      remainingContinuousControlsCoalesceByFrame ? 1 : 4,
    remainingContinuousControlsCoalesceByFrame,
    controlKitPrimitiveRendersPerKnobParentUpdate:
      controlKitPrimitivesIsolateRenders ? 2 : 36,
    controlKitUnrelatedPrimitiveRendersPerParentUpdate:
      controlKitPrimitivesIsolateRenders ? 0 : 34,
    controlKitKnobStaticTickAllocationsPerSteadyStateRender:
      controlKitPrimitivesIsolateRenders ? 0 : 11,
    controlKitFaderStaticTickAllocationsPerSteadyStateRender:
      controlKitPrimitivesIsolateRenders ? 0 : 5,
    controlKitPrimitivesIsolateRenders,
    soundDesignerBaseStageRendersPerAudioParamFrame:
      soundDesignerBaseStageIsolatesParamRenders ? 0 : 1,
    soundDesignerFoldedPresetRendersPerAudioParamFrame:
      soundDesignerBaseStageIsolatesParamRenders ? 0 : 1,
    soundDesignerBasePropBundleObjectsPerAudioParamFrame:
      soundDesignerBaseStageIsolatesParamRenders ? 0 : 1,
    soundDesignerBaseStageIsolatesParamRenders,
    soundDesignerMotionSliderRendersPerAudioParamFrame:
      soundDesignerAdvancedControlsIsolateRenders ? 1 : 8,
    soundDesignerMotionUnrelatedSliderRendersPerAudioParamFrame:
      soundDesignerAdvancedControlsIsolateRenders ? 0 : 7,
    soundDesignerAdvancedFooterRendersPerAudioParamFrame:
      soundDesignerAdvancedControlsIsolateRenders ? 0 : 1,
    soundDesignerUnchangedModMatrixRendersPerAudioParamFrame:
      soundDesignerAdvancedControlsIsolateRenders ? 0 : 1,
    soundDesignerAdvancedControlsIsolateRenders,
    normalizedUiSanitizationPassesPerAudioParamFrame:
      normalizedGlobalParamsAvoidDuplicateSanitize ? 1 : 2,
    duplicateRuntimeSanitizationPassesPerNormalizedUiFrame:
      normalizedGlobalParamsAvoidDuplicateSanitize ? 0 : 1,
    arbitraryGlobalParamCallerSanitizationPasses:
      normalizedGlobalParamsAvoidDuplicateSanitize ? 1 : 0,
    normalizedGlobalParamsAvoidDuplicateSanitize,
    audioParamSignatureArraysPerChangedRuntimeUpdate:
      audioParamChangeDetectionAvoidsSignatureSerialization ? 0 : 2,
    audioParamJoinedSignatureStringsPerChangedRuntimeUpdate:
      audioParamChangeDetectionAvoidsSignatureSerialization ? 0 : 1,
    audioParamSerializedRouteStringsPerChangedRuntimeUpdate:
      audioParamChangeDetectionAvoidsSignatureSerialization ? 0 : 1,
    audioParamChangeDetectionAvoidsSignatureSerialization,
    homeSessionSaveTimerCreationsPer600Updates:
      homeSessionPersistenceUsesDeadlineScheduler ? 51 : 600,
    homeSessionSaveTimerCancellationsPer600Updates:
      homeSessionPersistenceUsesDeadlineScheduler ? 0 : 599,
    homeSessionPersistenceUsesDeadlineScheduler
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
    tailwindBuildDependencies,
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
if (
  report.networkHints.earlyExternalStylesheets.length > 0
  || report.networkHints.preconnectOrigins.length > 0
) {
  failures.push({
    name: 'Guard third-party critical-path requests',
    stylesheets: report.networkHints.earlyExternalStylesheets,
    preconnects: report.networkHints.preconnectOrigins,
    expected: 'none'
  });
}
if (!sidebarHiddenPanelsFreezeContext) {
  failures.push({
    name: 'Guard hidden sidebar panels from context churn',
    actual: 'closed mounted panel subtrees rerender on sound or MIDI context updates',
    expected: 'cheap context bridge only, preserved local state, and immediate resync on reopen'
  });
}
if (retiredPublicArtifacts.length > 0 || productionServiceWorkerRegistrationCalls > 0) {
  failures.push({
    name: 'Guard inert service worker and orphan public assets',
    artifacts: retiredPublicArtifacts,
    serviceWorkerRegistrations: productionServiceWorkerRegistrationCalls,
    expected: 'none'
  });
}
if (
  sidebarIntentPrefetchImports !== 2
  || sidebarIntentPrefetchHandlers !== 4
  || !sidebarEscapeListenerIsOpenOnly
) {
  failures.push({
    name: 'Guard intent-driven sidebar work',
    routePrefetchImports: sidebarIntentPrefetchImports,
    intentHandlers: sidebarIntentPrefetchHandlers,
    escapeListener: sidebarEscapeListenerIsOpenOnly ? 'open-only' : 'always-on',
    expected: '2 imports, 4 intent handlers, open-only listener'
  });
}
if (
  (1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS) > 30
  || (1000 / SCENE_IDLE_FRAME_INTERVAL_MS) > 20
) {
  failures.push({
    name: 'Guard adaptive WebGL scene frame policy',
    activeHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
    idleHz: 1000 / SCENE_IDLE_FRAME_INTERVAL_MS,
    expected: 'active <= 30 Hz and idle <= 20 Hz'
  });
}
if (!waveCandyDefersFrameLoopUntilGraph) {
  failures.push({
    name: 'Guard cold analyzer frame-loop deferral',
    actual: 'polling before graph readiness',
    expected: 'status-triggered start'
  });
}
if (!waveCandyDefersCanvasResourcesUntilGraph) {
  failures.push({
    name: 'Guard cold analyzer canvas-resource deferral',
    actual: 'canvas resources before graph readiness',
    expected: 'graph-gated contexts and resize observers'
  });
}
if (!waveCandyCachesGradients) {
  failures.push({
    name: 'Guard resize-scoped analyzer gradients',
    creationSites: waveCandyGradientCreationSites,
    resizeScopedCaches: waveCandyResizeScopedGradientCaches,
    expected: 'all analyzer gradients cached until canvas resize'
  });
}
if (!waveCandyCachesSpectrumBinRanges) {
  failures.push({
    name: 'Guard configuration-scoped spectrum bin ranges',
    actual: 'log-frequency boundaries evaluated in active frame path',
    expected: 'cached until sample rate, FFT size, or bin count changes'
  });
}
if (!waveCandyCachesSpectrogramRowsAndPalette) {
  failures.push({
    name: 'Guard cached spectrogram rows and palette',
    actual: 'per-pixel row mapping or color formatting in active frame path',
    expected: 'configuration-scoped row runs and color lookup table'
  });
}
if (!waveCandyCachesLagrangeEnvelopePlan) {
  failures.push({
    name: 'Guard cached Lagrange envelope plan',
    actual: 'Chebyshev nodes or barycentric weights rebuilt in active analyzer frames',
    expected: 'one reusable interpolation plan per WaveCandy canvas'
  });
}
if (!waveCandyCachesStaticGridGeometry) {
  failures.push({
    name: 'Guard cached analyzer grid geometry',
    actual: 'static grid math or temporary collections recreated in active analyzer frames',
    expected: 'module-scoped ratios/path helper and direct resize acknowledgement'
  });
}
if (!waveCandyBatchesMeterGridPaths) {
  failures.push({
    name: 'Guard batched analyzer meter grid path',
    actual: 'one begin/stroke pair per loudness guide',
    expected: 'one shared begin/stroke pair for all five guides'
  });
}
if (!waveCandyHoistsTraceScales) {
  failures.push({
    name: 'Guard hoisted analyzer trace scales',
    actual: 'x-coordinate division inside waveform or spectrum point loop',
    expected: 'one width/span division per trace'
  });
}
if (!waveCandyDecimatesScopeTrace) {
  failures.push({
    name: 'Guard resolution-aware analyzer scope trace',
    actual: 'all analyser samples submitted regardless of canvas resolution',
    expected: 'at most two points per CSS pixel with final-sample preservation'
  });
}
if (!waveCandyDecimatesGoniometerTrace) {
  failures.push({
    name: 'Guard resolution-aware analyzer goniometer trace',
    actual: 'all stereo pairs submitted to Canvas regardless of tile resolution',
    expected: 'bounded Canvas points while every pair still contributes to meter statistics'
  });
}
if (!radarUsesBoundedPaletteCache) {
  failures.push({
    name: 'Guard bounded radar palette cache',
    actual: 'per-note palette construction in active render path',
    expected: 'numeric-key cache with at most 256 MIDI/active states'
  });
}
if (!radarCachesStaticGradients) {
  failures.push({
    name: 'Guard resize-scoped radar gradients',
    actual: 'static backdrop/grid gradients recreated in active frame path',
    expected: 'four cached gradients invalidated only by canvas dimensions'
  });
}
if (!radarCachesParticleColors) {
  failures.push({
    name: 'Guard bounded radar particle colors',
    actual: 'per-particle RGBA string formatting in active frame path',
    expected: '121-entry three-decimal alpha lookup table'
  });
}
if (!radarBatchesParticlePaths) {
  failures.push({
    name: 'Guard batched radar particle paths',
    actual: 'one Canvas path boundary pair per ambient particle',
    expected: 'at most 12 reusable alpha-bucket paths for all 32 particles'
  });
}
if (!radarLazilyInitializesParticleState) {
  failures.push({
    name: 'Guard lazy radar particle state initialization',
    actual: 'particle factories evaluated during React renders',
    expected: 'particle objects and typed path buffers allocated only on first mount'
  });
}
if (!radarReusesFrameContainers) {
  failures.push({
    name: 'Guard reusable radar frame containers',
    actual: 'argument, visible-range, or active-label containers allocated in playing frames',
    expected: 'positional draw calls with reusable range and label buffers'
  });
}
if (!radarUsesAllocationFreeLabelCollision) {
  failures.push({
    name: 'Guard allocation-free radar label collision scan',
    actual: 'per-active-note callback allocation',
    expected: 'indexed early-exit scan over reusable label positions'
  });
}
if (!sceneCachesBandRanges) {
  failures.push({
    name: 'Guard configuration-scoped scene band ranges',
    actual: 'frequency-to-bin boundaries evaluated in the WebGL active frame path',
    expected: 'cached until sample rate, FFT size, or bin count changes'
  });
}
if (!sceneReusesDebugState) {
  failures.push({
    name: 'Guard reusable WebGL scene diagnostics state',
    actual: 'new diagnostics object per active scene frame',
    expected: 'one stable object mutated in place'
  });
}
if (!vortexFieldReusesFrameStorage) {
  failures.push({
    name: 'Guard allocation-free scene vortex frames',
    actual: 'velocity objects or temporary arrays allocated in active vortex frames',
    expected: 'preallocated velocity/selection buffers and in-place particle compaction'
  });
}
if (
  (1000 / WAVE_CANDY_FRAME_INTERVAL_MS) > 30
  || MONO_ANALYSER_FFT_SIZE > 1024
  || STEREO_ANALYSER_FFT_SIZE > 1024
) {
  failures.push({
    name: 'Guard active analyzer sampling policy',
    frameHz: 1000 / WAVE_CANDY_FRAME_INTERVAL_MS,
    monoFftSize: MONO_ANALYSER_FFT_SIZE,
    stereoFftSize: STEREO_ANALYSER_FFT_SIZE,
    expected: '<= 30 Hz with <= 1024-sample mono/stereo windows'
  });
}
if (getStereoPairEvaluationsPerFrame() > 512) {
  failures.push({
    name: 'Guard merged stereo visual traversal',
    stereoPairEvaluationsPerFrame: getStereoPairEvaluationsPerFrame(),
    expected: '<= 512 shared meter/goniometer pairs per frame'
  });
}
const countBudgetChecks = [
  ['Guard initial JS requests', initialJs.length, 2],
  ['M11 explicit RAF sites', report.staticSignals.requestAnimationFrameCalls, 12],
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
if (!soundControlPanelCss || initialCssText.includes('.control-groups')) {
  failures.push({
    name: 'Guard deferred sound-control CSS',
    asset: soundControlPanelCss?.file || null,
    initial: initialCssText.includes('.control-groups') ? 'eager' : 'deferred',
    expected: 'one interaction-loaded asset'
  });
}
const routesWithSoundControlPanelCss = routeClosures
  .filter(({ includesSoundControlPanelCss }) => includesSoundControlPanelCss)
  .map(({ route }) => route);
if (routesWithSoundControlPanelCss.length > 0) {
  failures.push({
    name: 'Guard sound-control CSS route isolation',
    routes: routesWithSoundControlPanelCss,
    expected: 'sidebar interaction only'
  });
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
if (!appDefersScene || !appDefersWaveCandy) {
  failures.push({
    name: 'Guard Home decorative visual imports',
    scene: appDefersScene ? 'dynamic' : 'static',
    waveCandy: appDefersWaveCandy ? 'dynamic' : 'static',
    expected: 'dynamic'
  });
}
if (homeClosure?.includesScene || homeClosure?.includesWaveCandy) {
  failures.push({
    name: 'Guard Home critical visual isolation',
    actual: 'decorative visual closure included',
    expected: 'workspace shell only'
  });
}
if (appHeaderImportsAudioEngine) {
  failures.push({ name: 'Guard passive AppHeader engine isolation', actual: 'coupled', expected: 'controlled' });
}
const staticRoutesWithAudioEngine = routeClosures
  .filter(({ includesAudioEngine }) => includesAudioEngine)
  .map(({ route }) => route);
if (staticRoutesWithAudioEngine.length > 0) {
  failures.push({
    name: 'Guard route audio-runtime isolation',
    routes: staticRoutesWithAudioEngine,
    expected: 'interaction-loaded audio runtime'
  });
}
if (!audioEngineChunk) {
  failures.push({ name: 'Guard audio-engine chunk identity', actual: 0, minimum: 1 });
}
if (!audioGatewayDefersRuntime || audioEngineRuntimeManifestRecord?.isDynamicEntry !== true) {
  failures.push({
    name: 'Guard audio-runtime dynamic boundary',
    sourceImport: audioGatewayDefersRuntime ? 'dynamic' : 'static-or-missing',
    manifestEntry: audioEngineRuntimeManifestRecord?.isDynamicEntry ? 'dynamic' : 'static-or-missing',
    expected: 'dynamic'
  });
}
if (hardwareMidiReadinessCalls !== 1) {
  failures.push({
    name: 'Guard cold hardware-MIDI readiness',
    actual: hardwareMidiReadinessCalls,
    expected: 1
  });
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
const songStudyClosure = routeClosures.find(({ route }) => route === 'song-study');
if (!songStudyDefersMidiParser) {
  failures.push({ name: 'Guard Song Study parser import', actual: 'static', expected: 'dynamic' });
}
if (songStudyClosure?.includesMidiParser) {
  failures.push({ name: 'Guard Song Study parser isolation', actual: 'eager', expected: 'deferred' });
}
if (!songStudyDefersBirdsEyeRadar) {
  failures.push({ name: 'Guard Song Study radar import', actual: 'static', expected: 'dynamic' });
}
if (songStudyClosure?.includesBirdsEyeRadar) {
  failures.push({ name: 'Guard Song Study loading-shell radar isolation', actual: 'eager', expected: 'score-gated' });
}
if (!soundDesignerDefersWaveCandy) {
  failures.push({ name: 'Guard Sound Designer visualizer import', actual: 'static', expected: 'dynamic' });
}
if (deferredWaveCandyCss.length !== 1 || deferredBirdsEyeRadarCss.length !== 1) {
  failures.push({
    name: 'Guard deferred visual CSS chunks',
    waveCandy: deferredWaveCandyCss.length,
    birdsEyeRadar: deferredBirdsEyeRadarCss.length,
    expected: 1
  });
}
if (initialCssText.includes('.wave-candy-grid') || initialCssText.includes('.birds-eye-radar__canvas')) {
  failures.push({
    name: 'Guard visual CSS critical-path isolation',
    waveCandy: initialCssText.includes('.wave-candy-grid') ? 'eager' : 'deferred',
    birdsEyeRadar: initialCssText.includes('.birds-eye-radar__canvas') ? 'eager' : 'deferred',
    expected: 'deferred'
  });
}
if (!keyboardCssAsset || initialCssText.includes('.keyboard-wrapper')) {
  failures.push({
    name: 'Guard keyboard CSS component boundary',
    asset: keyboardCssAsset?.file || null,
    initial: initialCssText.includes('.keyboard-wrapper') ? 'eager' : 'deferred',
    expected: 'one non-initial asset'
  });
}
const playableRouteNames = new Set(['home', 'song-study', 'sound-designer']);
const routesWithIncorrectKeyboardCss = routeClosures
  .filter(({ route, includesKeyboardCss }) => (
    playableRouteNames.has(route) !== includesKeyboardCss
  ))
  .map(({ route }) => route);
if (routesWithIncorrectKeyboardCss.length > 0) {
  failures.push({
    name: 'Guard keyboard CSS route ownership',
    routes: routesWithIncorrectKeyboardCss,
    expected: 'playable routes only'
  });
}
if (!homeOverlayCssAsset || initialCssText.includes('.shortcuts-overlay')) {
  failures.push({
    name: 'Guard Home overlay CSS route boundary',
    asset: homeOverlayCssAsset?.file || null,
    initial: initialCssText.includes('.shortcuts-overlay') ? 'eager' : 'route-owned',
    expected: 'one Home-route asset'
  });
}
const routesWithIncorrectHomeOverlayCss = routeClosures
  .filter(({ route, includesHomeOverlayCss }) => ((route === 'home') !== includesHomeOverlayCss))
  .map(({ route }) => route);
if (routesWithIncorrectHomeOverlayCss.length > 0) {
  failures.push({
    name: 'Guard Home overlay CSS route ownership',
    routes: routesWithIncorrectHomeOverlayCss,
    expected: 'Home only'
  });
}
if (report.staticSignals.retiredOverlaySelectorCount > 0) {
  failures.push({
    name: 'Guard retired overlay selectors',
    actual: report.staticSignals.retiredOverlaySelectorCount,
    maximum: 0
  });
}
if (unreferencedOwnedCssClasses.length > 0) {
  failures.push({
    name: 'Guard owned CSS selector reachability',
    unreferenced: unreferencedOwnedCssClasses
  });
}
if (soundDesignerClosure?.includesWaveCandy) {
  failures.push({ name: 'Guard Sound Designer visualizer isolation', actual: 'eager', expected: 'deferred' });
}
if (!soundDesignerDefersAdvancedStages) {
  failures.push({ name: 'Guard Sound Designer advanced-stage import', actual: 'static', expected: 'dynamic' });
}
if (
  soundDesignerClosure?.includesAdvancedSoundDesignerStages
  || soundDesignerClosure?.includesAudioControlPrimitives
) {
  failures.push({
    name: 'Guard Sound Designer Base-stage isolation',
    actual: 'advanced controls in static closure',
    expected: 'Base stage only'
  });
}
if (obsoleteWasmBuildPlugins.length > 0) {
  failures.push({ name: 'Guard retired WASM build plugins', dependencies: obsoleteWasmBuildPlugins });
}
if (tailwindBuildDependencies.length > 0) {
  failures.push({ name: 'Guard unused Tailwind build dependency', dependencies: tailwindBuildDependencies });
}
if (report.staticSignals.tailwindDirectiveCount > 0) {
  failures.push({
    name: 'Guard unused Tailwind source directives',
    actual: report.staticSignals.tailwindDirectiveCount,
    maximum: 0
  });
}
if (report.staticSignals.generatedTailwindVariableCount > 0) {
  failures.push({
    name: 'Guard generated Tailwind CSS variables',
    actual: report.staticSignals.generatedTailwindVariableCount,
    maximum: 0
  });
}
if (missingCriticalGlobalCssSelectors.length > 0) {
  failures.push({
    name: 'Guard critical global CSS selectors',
    missing: missingCriticalGlobalCssSelectors
  });
}
if (report.staticSignals.wasmModuleImports > 0) {
  failures.push({ name: 'Guard retired WASM module imports', actual: report.staticSignals.wasmModuleImports, maximum: 0 });
}
if (eagerPlayableRouteAudioWarmupCalls > 0) {
  failures.push({
    name: 'Guard eager playable-route audio warmup',
    actual: eagerPlayableRouteAudioWarmupCalls,
    maximum: 0
  });
}
if (deferredAudioWarmupConsumers !== 3) {
  failures.push({
    name: 'Guard deferred playable-route audio warmup',
    actual: deferredAudioWarmupConsumers,
    expected: 3
  });
}
if (deferredVisualMountConsumers !== 3) {
  failures.push({
    name: 'Guard deferred visual mount coverage',
    actual: deferredVisualMountConsumers,
    expected: 3
  });
}
if (eagerMutableHookInitializers !== 0) {
  failures.push({
    name: 'Guard lazy mutable React hook initialization',
    actual: eagerMutableHookInitializers,
    expected: 0
  });
}
if (!appLoadsSessionOnce) {
  failures.push({
    name: 'Guard one-time app session restoration',
    actual: 'saved session loaded during React renders',
    expected: 'lazy useState initializer invoked once per App mount'
  });
}
if (!midiSchedulerAvoidsWholeScoreQueue) {
  failures.push({
    name: 'Guard allocation-free MIDI scheduler startup',
    actual: 'whole-score wrapper/filter queue allocated per schedule operation',
    expected: 'direct indexed traversal of the normalized note array'
  });
}
if (!midiNormalizerUsesOnePassFastPath) {
  failures.push({
    name: 'Guard one-pass MIDI note normalization',
    actual: 'map/filter intermediates or unconditional sorting in import path',
    expected: 'one output array with sorting only for detected unsorted input'
  });
}
if (!pipelinePollingReusesJobSnapshots) {
  failures.push({
    name: 'Guard revision-aware pipeline polling',
    actual: 'fresh job identities committed for unchanged poll responses',
    expected: 'id/updated_at snapshot reuse across all three polling routes'
  });
}
if (!voiceLoopDefersScoreRenderUntilInteraction) {
  failures.push({
    name: 'Guard interaction-first Voice Loop rendering',
    actual: 'AudioContext and score rendering scheduled before playback interaction',
    expected: 'revision-aware rendering on first play and debounced only while playing'
  });
}
if (!voiceLoopUsesTargetedPlayheadFeedback) {
  failures.push({
    name: 'Guard targeted Voice Loop playhead feedback',
    actual: 'playhead animation commits React state and reconciles the full composer',
    expected: 'visibility-aware direct previous/current score-cell feedback'
  });
}
if (!voiceLoopContinuousRangesCoalesceByFrame) {
  failures.push({
    name: 'Guard Voice Loop continuous controls at display cadence',
    actual: 'range samples clone route state at raw device rate',
    expected: 'latest numeric patch once per frame with release flush and unmount cleanup'
  });
}
if (!songStudyPointerScrubDefersEngineSeek) {
  failures.push({
    name: 'Guard Song Study pointer scrub scheduling',
    actual: 'raw pointer samples rebuild MIDI scheduling and active voices',
    expected: 'frame-rate visual preview and one exact engine seek on release'
  });
}
if (!songStudyTitleFitCoalescesByFrame) {
  failures.push({
    name: 'Guard Song Study title fitting work',
    actual: 'duplicate resize sources or repeated synchronous layout fitting remain',
    expected: 'one cached fit per frame, observer/fallback exclusivity, and teardown-safe font work'
  });
}
if (!keyboardAvoidsUnobservedInteractionWork) {
  failures.push({
    name: 'Guard allocation-free unprofiled keyboard interaction path',
    actual: 'unused velocity state or always-on profiling work remains in note playback',
    expected: 'DOM-only key feedback and note timing gated by the central performance probe'
  });
}
if (!keyboardCoalescesPointerMovesByFrame) {
  failures.push({
    name: 'Guard frame-coalesced keyboard pointer glissando',
    actual: 'raw pointer samples trigger synchronous DOM hit-testing and metadata parsing',
    expected: 'one passive, latest-position pointer update per active pointer per frame'
  });
}
if (!sharedVisualRenderIsolation) {
  failures.push({
    name: 'Guard shared keyboard and radar render isolation',
    actual: 'unchanged key elements or radar snapshots rebuild on unrelated parent state',
    expected: 'visually keyed element caches, reusable radar props, and a radar memo boundary'
  });
}
if (!valueSliderCoalescesPointerMovesByFrame) {
  failures.push({
    name: 'Guard frame-coalesced value-slider dragging',
    actual: 'raw pointer samples synchronously read layout and update parent state',
    expected: 'latest-coordinate layout read and change callback once per frame with release flush'
  });
}
if (!remainingContinuousControlsCoalesceByFrame) {
  failures.push({
    name: 'Guard all remaining continuous controls at display cadence',
    actual: 'effect dials or control-kit drag primitives publish at raw device rate',
    expected: 'latest-axis value once per frame with synchronous release flush and cleanup'
  });
}
if (!controlKitPrimitivesIsolateRenders) {
  failures.push({
    name: 'Guard Control Kit primitive render isolation',
    actual: 'unrelated controls or static SVG ticks rebuild on each parent update',
    expected: 'memoized primitives, stable page props, and hoisted knob/fader tick geometry'
  });
}
if (!soundDesignerBaseStageIsolatesParamRenders) {
  failures.push({
    name: 'Guard Sound Designer base-stage render isolation',
    actual: 'audio parameter frames rebuild waveform and folded-preset subtrees',
    expected: 'memoized base/footer/shelf with a save-free stable preset prop bundle'
  });
}
if (!soundDesignerAdvancedControlsIsolateRenders) {
  failures.push({
    name: 'Guard Sound Designer advanced-control render isolation',
    actual: 'one parameter frame rebuilds unrelated sliders, routes, or footer navigation',
    expected: 'parameter-keyed slider memoization plus route-aware matrix and static-footer boundaries'
  });
}
if (!normalizedGlobalParamsAvoidDuplicateSanitize) {
  failures.push({
    name: 'Guard normalized audio-parameter runtime handoff',
    actual: 'already-normalized UI state is sanitized again by the loaded runtime',
    expected: 'explicit normalized handoff with lazy-load preservation and defensive arbitrary-input path'
  });
}
if (!audioParamChangeDetectionAvoidsSignatureSerialization) {
  failures.push({
    name: 'Guard allocation-free audio-parameter change detection',
    actual: 'runtime updates format and serialize the full parameter object into a signature',
    expected: 'fixed-key scalar comparison with exact modulation-route fields and force-reapply sentinel'
  });
}
if (!homeSessionPersistenceUsesDeadlineScheduler) {
  failures.push({
    name: 'Guard Home session-persistence deadline scheduler',
    actual: 'continuous state updates recreate and cancel the trailing-save timeout each frame',
    expected: 'one deadline-driven timer chain with final snapshot, page-exit flush, and cleanup'
  });
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
  checks: budgetChecks.length + countBudgetChecks.length + routeBudgetChecks.length + 98,
  failures
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
