import { sanitizeAudioParams } from './audioParams.js';

const STORAGE_KEY = 'vangelis-ui-session-v1';

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

const coerceResumePayload = (value) => {
  if (!value || typeof value !== 'object') return null;

  const result = {};
  if (typeof value.midiPath === 'string' && value.midiPath.length > 0) result.midiPath = value.midiPath;
  if (typeof value.midiName === 'string' && value.midiName.length > 0) result.midiName = value.midiName;
  if (typeof value.midiSourceFileId === 'string' && value.midiSourceFileId.length > 0) {
    result.midiSourceFileId = value.midiSourceFileId;
  }
  if (typeof value.midiSourceUrl === 'string' && value.midiSourceUrl.length > 0) {
    result.midiSourceUrl = value.midiSourceUrl;
  }
  if (typeof value.tempoFactor === 'number' && Number.isFinite(value.tempoFactor)) {
    result.tempoFactor = Math.max(0.25, Math.min(2, value.tempoFactor));
  }
  const sampleSelection = coerceSampleSelection(value.sampleSelection);
  if (sampleSelection) result.sampleSelection = sampleSelection;
  if (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)) {
    result.updatedAt = value.updatedAt;
  }

  return result.midiPath || result.sampleSelection ? result : null;
};

export const getDefaultSessionState = () => ({
  waveformType: null,
  audioParams: null,
  sidebarTab: 'midi',
  sidebarOpen: false,
  activeSampleId: null,
  sampleSelection: null,
  showShortcuts: false,
  tempoFactor: 1,
  resume: null
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
    const audioParams = sanitizeAudioParams(parsed.audioParams || undefined);

    return {
      ...fallback,
      waveformType: typeof parsed.waveformType === 'string' ? parsed.waveformType : null,
      audioParams,
      sidebarTab: coerceSidebarTab(parsed.sidebarTab),
      sidebarOpen: !!parsed.sidebarOpen,
      activeSampleId: typeof parsed.activeSampleId === 'string' ? parsed.activeSampleId : null,
      sampleSelection: coerceSampleSelection(parsed.sampleSelection),
      showShortcuts: !!parsed.showShortcuts,
      tempoFactor: typeof parsed.tempoFactor === 'number' && Number.isFinite(parsed.tempoFactor)
        ? Math.max(0.25, Math.min(2, parsed.tempoFactor))
        : 1,
      resume: coerceResumePayload(parsed.resume)
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
