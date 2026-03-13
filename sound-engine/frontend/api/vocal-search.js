const { getSearchConfiguration, searchVocals } = require('./lib/vocalSearch.js');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      version: 1,
      configuration: getSearchConfiguration()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestBody = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    const payload = await searchVocals(requestBody);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Failed to search vocals:', error);
    return res.status(500).json({
      error: 'Failed to search vocals',
      configuration: getSearchConfiguration()
    });
  }
};
