import { normalizeBase, withBase } from './baseUrl.js';

export const APP_ROUTES = Object.freeze({
  synth: 'synth',
  vocalFinder: 'vocal-finder'
});

const VOCAL_FINDER_PATH = '/vocal-finder';

const isAbsoluteBase = (value) => /^https?:\/\//i.test(value);

const normalizeRoutePath = (value = '/') => {
  if (typeof value !== 'string' || value.length === 0) return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
};

const toBasePath = (base = import.meta.env.BASE_URL) => {
  const normalized = normalizeBase(base);
  if (isAbsoluteBase(normalized)) {
    return normalizeRoutePath(new URL(normalized).pathname);
  }
  return normalized === '/' ? '/' : normalizeRoutePath(normalized);
};

const stripBasePath = (pathname, base = import.meta.env.BASE_URL) => {
  const normalizedPath = normalizeRoutePath(pathname);
  const basePath = toBasePath(base);

  if (basePath === '/') return normalizedPath;
  if (normalizedPath === basePath) return '/';
  if (normalizedPath.startsWith(`${basePath}/`)) {
    return normalizeRoutePath(normalizedPath.slice(basePath.length));
  }

  return normalizedPath;
};

const resolveRoute = (path) => (
  normalizeRoutePath(path) === VOCAL_FINDER_PATH ? APP_ROUTES.vocalFinder : APP_ROUTES.synth
);

export const getCurrentRoute = (base = import.meta.env.BASE_URL) => {
  if (typeof window === 'undefined') return APP_ROUTES.synth;

  const hash = window.location.hash || '';
  if (hash.startsWith('#/')) {
    return resolveRoute(hash.slice(1));
  }

  return resolveRoute(stripBasePath(window.location.pathname, base));
};

export const getRouteHref = (route, base = import.meta.env.BASE_URL) => {
  if (route === APP_ROUTES.vocalFinder) {
    return `${withBase('', base)}#/vocal-finder`;
  }

  return withBase('', base);
};

export const subscribeToRouteChanges = (listener, base = import.meta.env.BASE_URL) => {
  if (typeof window === 'undefined' || typeof listener !== 'function') {
    return () => {};
  }

  const handleRouteChange = () => {
    listener(getCurrentRoute(base));
  };

  window.addEventListener('hashchange', handleRouteChange);
  window.addEventListener('popstate', handleRouteChange);

  return () => {
    window.removeEventListener('hashchange', handleRouteChange);
    window.removeEventListener('popstate', handleRouteChange);
  };
};
