const { createHash } = require('crypto');

function buildSmsIdempotencyKey(userId, vehicleId, action) {
  const bucket = Math.floor(Date.now() / 60_000);
  return createHash('sha256')
    .update(`${userId}:${vehicleId}:${action}:${bucket}`)
    .digest('hex');
}

module.exports = { buildSmsIdempotencyKey };
