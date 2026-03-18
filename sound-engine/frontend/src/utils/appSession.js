import { sanitizeAudioParams, upgradeLegacyAudioParams } from './audioParams.js';

const STORAGE_KEY = 'vangelis-ui-session-v2';
const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: false
});

const coerceSidebarTab = (value) => (value === 'samples' ? 'samples' : 'midi');

const coerceSampleSelection = (value) => {
  if (!value || typeof value !== 'object') return null;

  const { type, id, name, sourceUrl, mimeType, baseNote } = value;
  if (type !== 'starter' && type !== 'stored') return null;
  if (typeof id !== 'string' || id.length === 0) return null;

  const normalized = { type, id };
  if (typeof name === 'string' && name.length > 0) normalized.name = name;
  if (typeof sourceUrl === 'string' && sourceUrl.length > 0) normalized.sourceUrl = sourceUrl;
  if (typeof mimeType === 'string' && mimeType.length > 0) normalized.mimeType = mimeType;
  if (typeof baseNote === 'string' && baseNote.length > 0) normalized.baseNote = baseNote;
  return normalized;
};

const coerceControlSections = (value) => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CONTROL_SECTIONS;
  }

  return {
    essentials: value.essentials !== false,
    delay: !!value.delay,
    reverb: !!value.reverb,
    color: !!value.color,
    modulation: !!value.modulation
  };
};

export const getDefaultSessionState = () => ({
  waveformType: null,
  audioParams: null,
  controlSections: DEFAULT_CONTROL_SECTIONS,
  sidebarTab: 'midi',
  sidebarOpen: false,
  activeSampleId: null,
  sampleSelection: null,
  showShortcuts: false,
  tempoFactor: 1
});

export function loadAppSession() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultSessionState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSessionState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultSessionState();

    const fallback = getDefaultSessionState();
    const audioParams = sanitizeAudioParams(
      upgradeLegacyAudioParams(parsed.audioParams || undefined)
    );

    return {
      ...fallback,
      waveformType: typeof parsed.waveformType === 'string' ? parsed.waveformType : null,
      audioParams,
      controlSections: coerceControlSections(parsed.controlSections),
      sidebarTab: coerceSidebarTab(parsed.sidebarTab),
      sidebarOpen: !!parsed.sidebarOpen,
      activeSampleId: typeof parsed.activeSampleId === 'string' ? parsed.activeSampleId : null,
      sampleSelection: coerceSampleSelection(parsed.sampleSelection),
      showShortcuts: !!parsed.showShortcuts,
      tempoFactor: typeof parsed.tempoFactor === 'number' && Number.isFinite(parsed.tempoFactor)
        ? Math.max(0.25, Math.min(2, parsed.tempoFactor))
        : 1
    };
  } catch {
    return getDefaultSessionState();
  }
}

export function saveAppSession(nextState) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Best effort write. Ignore quota/private mode failures.
  }
}
