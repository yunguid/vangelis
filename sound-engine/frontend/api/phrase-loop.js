const { generatePhraseLoop } = require('./lib/phraseLoopGenerator.js');

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
    const payload = parseBody(req.body);
    const result = await generatePhraseLoop(payload);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to generate phrase loop:', error);
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || 'Phrase loop generation failed.',
      providerError: error.providerError || null
    });
  }
};
