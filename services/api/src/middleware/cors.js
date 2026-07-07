function cors(req, res, next) {
  const origin = process.env.CORS_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-User');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

module.exports = cors;
