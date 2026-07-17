const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  if (!key || plaintext == null) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(payload) {
  const key = getEncryptionKey();
  if (!key || !payload) return null;

  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function isEncryptionEnabled() {
  return Boolean(getEncryptionKey());
}

module.exports = { encrypt, decrypt, isEncryptionEnabled };
