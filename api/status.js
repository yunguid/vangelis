module.exports = function handler(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'vangelis-frontend',
    timestamp: new Date().toISOString()
  });
};
