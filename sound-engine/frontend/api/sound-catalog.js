const { listCatalogItems } = require('./lib/soundCatalogDb.js');

function coerceQueryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseLimit(value) {
  const numeric = Number.parseInt(coerceQueryValue(value), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.min(numeric, 256);
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const family = coerceQueryValue(req.query?.family);
    const search = coerceQueryValue(req.query?.q || req.query?.search);
    const limit = parseLimit(req.query?.limit);
    const items = await listCatalogItems({
      family: typeof family === 'string' ? family.trim().toLowerCase() : null,
      search: typeof search === 'string' ? search.trim() : null,
      limit
    });

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json({
      version: 1,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Failed to serve sound catalog:', error);
    return res.status(500).json({ error: 'Failed to load sound catalog' });
  }
};
