function cors(req, res, next) {
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  const selected = allowed.includes('*')
    ? (origin || '*')
    : (origin && allowed.includes(origin) ? origin : allowed[0]);

  if (selected) {
    res.header('Access-Control-Allow-Origin', selected);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-User, X-CSRF-Token, X-Request-Id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

module.exports = cors;
