export const HOME_ROUTE = '/';
export const HOME_HREF = '#/';

export const MIDI_PIPELINE_ROUTE = '/pipeline/midi-builder';
export const MIDI_PIPELINE_HREF = `#${MIDI_PIPELINE_ROUTE}`;

export const VOICE_LOOP_ROUTE = '/voice-loop';
export const VOICE_LOOP_HREF = `#${VOICE_LOOP_ROUTE}`;

export const SOUND_DESIGNER_ROUTE = '/sound-designer';
export const SOUND_DESIGNER_HREF = `#${SOUND_DESIGNER_ROUTE}`;

// Hidden specimen sheet for the ground-up control-kit proposal (see
// INTERFACE_LEDGER.md's handoff). Linked from nowhere — reached only by
// navigating to the hash directly.
export const CONTROL_KIT_ROUTE = '/control-kit';
export const CONTROL_KIT_HREF = `#${CONTROL_KIT_ROUTE}`;

export const STUDY_SONGS_ROUTE = '/studies';
export const STUDY_SONGS_HREF = `#${STUDY_SONGS_ROUTE}`;

export const getStudySongRoute = (slug) => `/studies/${slug}`;
export const getStudySongHref = (slug) => `#${getStudySongRoute(slug)}`;

export const TO_THE_UNKNOWN_MAN_STUDY_ROUTE = getStudySongRoute('to-the-unknown-man');
export const TO_THE_UNKNOWN_MAN_STUDY_HREF = `#${TO_THE_UNKNOWN_MAN_STUDY_ROUTE}`;

export const getGeneratedStudyRoute = (jobId) => `/studies/generated/${jobId}`;
export const getGeneratedStudyHref = (jobId) => `#${getGeneratedStudyRoute(jobId)}`;

export const getActiveRoute = () => {
  if (typeof window === 'undefined') return HOME_ROUTE;

  const hashRoute = window.location.hash.replace(/^#/, '').trim();
  if (hashRoute.length > 0) {
    return hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
  }

  return window.location.pathname || HOME_ROUTE;
};

export const isMidiPipelineRoute = (route) => (
  route === MIDI_PIPELINE_ROUTE
  || route === `${MIDI_PIPELINE_ROUTE}/`
);

export const isVoiceLoopRoute = (route) => (
  route === VOICE_LOOP_ROUTE
  || route === `${VOICE_LOOP_ROUTE}/`
);

export const isSoundDesignerRoute = (route) => (
  route === SOUND_DESIGNER_ROUTE
  || route === `${SOUND_DESIGNER_ROUTE}/`
);

export const isControlKitRoute = (route) => (
  route === CONTROL_KIT_ROUTE
  || route === `${CONTROL_KIT_ROUTE}/`
);

export const isStudySongsRoute = (route) => (
  route === STUDY_SONGS_ROUTE
  || route === `${STUDY_SONGS_ROUTE}/`
);

export const getStudyRouteMatch = (route) => {
  const normalizedRoute = route.endsWith('/') && route.length > 1
    ? route.slice(0, -1)
    : route;

  const generatedPrefix = '/studies/generated/';
  if (normalizedRoute.startsWith(generatedPrefix)) {
    const jobId = normalizedRoute.slice(generatedPrefix.length).trim();
    return jobId ? { kind: 'generated', jobId } : null;
  }

  const builtinPrefix = '/studies/';
  if (normalizedRoute.startsWith(builtinPrefix) && !isStudySongsRoute(normalizedRoute)) {
    const slug = normalizedRoute.slice(builtinPrefix.length).trim();
    return slug ? { kind: 'builtin', slug } : null;
  }

  return null;
};

export const isToTheUnknownManStudyRoute = (route) => {
  const match = getStudyRouteMatch(route);
  return match?.kind === 'builtin' && match.slug === 'to-the-unknown-man';
};
