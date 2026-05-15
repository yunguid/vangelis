const { fallbackPhrase, generateVoicePhrase } = require('./lib/voicePhraseGenerator.js');

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  if (typeof body !== 'string') return {};

  try {
    return JSON.parse(body);
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await generateVoicePhrase(parseBody(req.body));
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to generate voice phrase:', error);
    return res.status(200).json({
      source: 'fallback',
      model: null,
      warning: 'Voice phrase generator fell back to the local phrase engine.',
      phrase: fallbackPhrase()
    });
  }
};
