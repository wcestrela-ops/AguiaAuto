const bcrypt = require('bcryptjs');
const argon2 = require('argon2');

const ARGON2_PREFIX = '$argon2';
const BCRYPT_PREFIX = '$2';

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST || '3', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1', 10),
  });
}

function isArgon2Hash(hash) {
  return String(hash || '').startsWith(ARGON2_PREFIX);
}

function isBcryptHash(hash) {
  return String(hash || '').startsWith(BCRYPT_PREFIX);
}

async function verifyPassword(password, hash) {
  if (!hash) return { valid: false, needsRehash: false };
  if (isArgon2Hash(hash)) {
    try {
      const valid = await argon2.verify(hash, password);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }
  if (isBcryptHash(hash)) {
    const valid = await bcrypt.compare(password, hash);
    return { valid, needsRehash: valid };
  }
  return { valid: false, needsRehash: false };
}

async function rehashIfNeeded(userId, password, hash, updateFn) {
  const result = await verifyPassword(password, hash);
  if (result.valid && result.needsRehash) {
    const newHash = await hashPassword(password);
    await updateFn(userId, newHash);
  }
  return result.valid;
}

module.exports = {
  hashPassword,
  verifyPassword,
  rehashIfNeeded,
  isArgon2Hash,
  isBcryptHash,
};
