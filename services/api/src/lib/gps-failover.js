const FAILOVER_PATTERNS = [
  'fetch failed',
  'econnrefused',
  'enotfound',
  'network',
  'gateway',
  'offline',
  'indispon',
  '503',
  '502',
  '504',
  'requer api_hash',
  'timeout',
  'aborterror',
  'socket hang up',
  'failed to fetch',
];

const NO_FAILOVER_PATTERNS = [
  'duplic',
  'unknown',
  'aceito',
  'accepted',
  'external',
];

function isGpsFailoverEligible(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message) return false;
  if (NO_FAILOVER_PATTERNS.some((pattern) => message.includes(pattern))) {
    return false;
  }
  return FAILOVER_PATTERNS.some((pattern) => message.includes(pattern));
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return phone || '';
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} *****-${digits.slice(-4)}`;
}

module.exports = { isGpsFailoverEligible, maskPhone };
