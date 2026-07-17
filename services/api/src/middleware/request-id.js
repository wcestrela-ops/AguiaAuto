const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = incoming && String(incoming).length <= 64
    ? String(incoming)
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestIdMiddleware };
