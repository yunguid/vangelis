import { withBase } from './baseUrl.js';

export const STARTER_FAMILY_ORDER = Object.freeze([
  'piano',
  'strings',
  'brass',
  'reed',
  'chromatic percussion',
  'bass',
  'synth',
  'texture'
]);

export const encodeSamplePath = (samplePath = '') =>
  samplePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const cloneInstrumentDefinition = (instrument) => ({
  ...instrument,
  families: Array.isArray(instrument?.families) ? [...instrument.families] : instrument?.families,
  names: Array.isArray(instrument?.names) ? [...instrument.names] : instrument?.names
});

const cloneCatalogItem = (item) => ({
  ...item,
  tags: Array.isArray(item?.tags) ? [...item.tags] : item?.tags
});

const toCatalogKey = (item) => {
  if (typeof item?.id === 'string' && item.id.length > 0) return item.id;
  if (typeof item?.samplePath === 'string' && item.samplePath.length > 0) return item.samplePath;
  if (typeof item?.sourceUrl === 'string' && item.sourceUrl.length > 0) return item.sourceUrl;
  return null;
};

export const hydrateCatalogItems = (items, base = import.meta.env.BASE_URL) => (
  (items || [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const normalized = cloneCatalogItem(item);
      const sourceUrl = normalized.sourceUrl
        || (normalized.samplePath ? withBase(`samples/${encodeSamplePath(normalized.samplePath)}`, base) : null);

      if (!sourceUrl) return null;

      return {
        ...normalized,
        mimeType: normalized.mimeType || 'audio/wav',
        sourceUrl
      };
    })
    .filter(Boolean)
);

export const mergeCatalogItems = (baseItems, overrideItems, base = import.meta.env.BASE_URL) => {
  const byKey = new Map();

  hydrateCatalogItems(baseItems, base).forEach((item) => {
    const key = toCatalogKey(item);
    if (!key) return;
    byKey.set(key, item);
  });

  hydrateCatalogItems(overrideItems, base).forEach((item) => {
    const key = toCatalogKey(item);
    if (!key) return;
    byKey.set(key, item);
  });

  return [...byKey.values()].sort((a, b) => {
    const familyRankA = STARTER_FAMILY_ORDER.indexOf(a.family);
    const familyRankB = STARTER_FAMILY_ORDER.indexOf(b.family);
    const normalizedRankA = familyRankA === -1 ? 999 : familyRankA;
    const normalizedRankB = familyRankB === -1 ? 999 : familyRankB;

    if (normalizedRankA !== normalizedRankB) {
      return normalizedRankA - normalizedRankB;
    }

    return a.name.localeCompare(b.name);
  });
};

export const mergeSoundSetManifestLists = (baseManifests, overrideManifests) => {
  const byId = new Map();

  (baseManifests || []).forEach((manifest) => {
    if (!manifest?.id) return;
    byId.set(manifest.id, {
      ...manifest,
      quality: manifest.quality ? { ...manifest.quality } : manifest.quality,
      layerFamilies: Array.isArray(manifest.layerFamilies) ? [...manifest.layerFamilies] : manifest.layerFamilies,
      instruments: Array.isArray(manifest.instruments) ? manifest.instruments.map(cloneInstrumentDefinition) : []
    });
  });

  (overrideManifests || []).forEach((override) => {
    if (!override?.id) return;

    if (!byId.has(override.id)) {
      byId.set(override.id, {
        ...override,
        quality: override.quality ? { ...override.quality } : override.quality,
        layerFamilies: Array.isArray(override.layerFamilies) ? [...override.layerFamilies] : override.layerFamilies,
        instruments: Array.isArray(override.instruments) ? override.instruments.map(cloneInstrumentDefinition) : []
      });
      return;
    }

    const base = byId.get(override.id);
    const nextInstruments = Array.isArray(base.instruments) ? [...base.instruments] : [];
    const indexById = new Map();
    nextInstruments.forEach((instrument, index) => {
      if (typeof instrument?.id === 'string' && instrument.id.length > 0) {
        indexById.set(instrument.id, index);
      }
    });

    (override.instruments || []).forEach((instrument) => {
      if (typeof instrument?.id === 'string' && instrument.id.length > 0 && indexById.has(instrument.id)) {
        const index = indexById.get(instrument.id);
        nextInstruments[index] = {
          ...nextInstruments[index],
          ...instrument,
          families: Array.isArray(instrument.families) ? [...instrument.families] : nextInstruments[index].families,
          names: Array.isArray(instrument.names) ? [...instrument.names] : nextInstruments[index].names
        };
        return;
      }

      nextInstruments.push(cloneInstrumentDefinition(instrument));
    });

    byId.set(override.id, {
      ...base,
      ...override,
      quality: override.quality ? { ...(base.quality || {}), ...override.quality } : base.quality,
      layerFamilies: Array.isArray(override.layerFamilies) ? [...override.layerFamilies] : base.layerFamilies,
      instruments: nextInstruments
    });
  });

  return [...byId.values()];
};

export const buildStarterCatalog = (manifests, base = import.meta.env.BASE_URL) => {
  const uniqueByPath = new Map();

  (manifests || []).forEach((soundSet) => {
    (soundSet.instruments || []).forEach((instrument) => {
      if (!instrument.samplePath) return;
      if (uniqueByPath.has(instrument.samplePath)) return;

      const family = (instrument.families || [])[0] || 'other';
      uniqueByPath.set(instrument.samplePath, {
        id: `starter-${soundSet.id}-${instrument.id}`,
        soundSetId: soundSet.id,
        instrumentId: instrument.id,
        name: instrument.label || instrument.id,
        family,
        baseNote: instrument.baseNote || null,
        samplePath: instrument.samplePath,
        mimeType: 'audio/wav'
      });
    });
  });

  return mergeCatalogItems([], [...uniqueByPath.values()], base);
};

export const selectFeaturedStarterItems = (items, maxTotal = 16, maxPerFamily = 4) => {
  const grouped = new Map();
  items.forEach((item) => {
    if (!grouped.has(item.family)) {
      grouped.set(item.family, []);
    }
    grouped.get(item.family).push(item);
  });

  const featured = [];
  const consumeFamily = (family) => {
    const familyItems = grouped.get(family) || [];
    for (let i = 0; i < familyItems.length && i < maxPerFamily && featured.length < maxTotal; i += 1) {
      featured.push(familyItems[i]);
    }
    grouped.delete(family);
  };

  STARTER_FAMILY_ORDER.forEach(consumeFamily);

  if (featured.length < maxTotal) {
    const leftovers = [...grouped.values()].flat();
    leftovers.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of leftovers) {
      if (featured.length >= maxTotal) break;
      featured.push(item);
    }
  }

  return featured;
};
