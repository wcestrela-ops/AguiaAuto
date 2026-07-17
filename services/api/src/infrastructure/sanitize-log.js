const SENSITIVE_KEYS = /password|token|secret|api_key|apikey|authorization|cpf|cnpj|pix|refresh_token|access_token/i;

function maskValue(key, value) {
  if (value == null) return value;
  const text = String(value);
  if (/cpf|cnpj/i.test(key)) {
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 4) return `***${digits.slice(-4)}`;
    return '***';
  }
  if (/pix/i.test(key)) return '***PIX***';
  if (text.length <= 4) return '***';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function sanitizeLogMeta(meta = {}) {
  if (Array.isArray(meta)) return meta.map((item) => sanitizeLogMeta(item));
  if (meta && typeof meta === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(meta)) {
      if (SENSITIVE_KEYS.test(key)) {
        out[key] = maskValue(key, value);
      } else if (value && typeof value === 'object') {
        out[key] = sanitizeLogMeta(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return meta;
}

function sanitizeForLog(payload) {
  return sanitizeLogMeta(payload);
}

module.exports = { sanitizeLogMeta, sanitizeForLog, maskValue };
