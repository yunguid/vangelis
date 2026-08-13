export const HOME_ROUTE = '/';
export const HOME_HREF = '#/';

export const SOUND_DESIGNER_ROUTE = '/sound-designer';
export const SOUND_DESIGNER_HREF = `#${SOUND_DESIGNER_ROUTE}`;

export const PIANO_ROLL_ROUTE = '/editor';
export const PIANO_ROLL_HREF = `#${PIANO_ROLL_ROUTE}`;

export const STUDY_SONGS_ROUTE = '/studies';
export const STUDY_SONGS_HREF = `#${STUDY_SONGS_ROUTE}`;

export const getStudySongRoute = (slug) => `/studies/${slug}`;
export const getStudySongHref = (slug) => `#${getStudySongRoute(slug)}`;

export const TO_THE_UNKNOWN_MAN_STUDY_ROUTE = getStudySongRoute('to-the-unknown-man');
export const TO_THE_UNKNOWN_MAN_STUDY_HREF = `#${TO_THE_UNKNOWN_MAN_STUDY_ROUTE}`;

export const getActiveRoute = () => {
  if (typeof window === 'undefined') return HOME_ROUTE;

  const hashRoute = window.location.hash.replace(/^#/, '').trim();
  if (hashRoute.length > 0) {
    return hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
  }

  return window.location.pathname || HOME_ROUTE;
};

export const isSoundDesignerRoute = (route) => (
  route === SOUND_DESIGNER_ROUTE
  || route === `${SOUND_DESIGNER_ROUTE}/`
);

export const isPianoRollRoute = (route) => (
  route === PIANO_ROLL_ROUTE
  || route === `${PIANO_ROLL_ROUTE}/`
);

export const isStudySongsRoute = (route) => (
  route === STUDY_SONGS_ROUTE
  || route === `${STUDY_SONGS_ROUTE}/`
);

export const getStudyRouteMatch = (route) => {
  const normalizedRoute = route.endsWith('/') && route.length > 1
    ? route.slice(0, -1)
    : route;

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
