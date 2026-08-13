const DEFAULT_BASE = '/';

const isAbsoluteBase = (value) => /^https?:\/\//i.test(value);

export const normalizeBase = (base = DEFAULT_BASE) => {
  if (typeof base !== 'string' || base.length === 0) {
    return DEFAULT_BASE;
  }
  return base.endsWith('/') ? base : `${base}/`;
};

export const withBase = (path, base = import.meta.env.BASE_URL) => {
  const normalized = normalizeBase(base ?? DEFAULT_BASE);
  if (isAbsoluteBase(normalized)) {
    return new URL(path, normalized).toString();
  }
  return `${normalized}${path}`;
};
