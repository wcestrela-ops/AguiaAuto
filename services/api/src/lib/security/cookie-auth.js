const crypto = require('crypto');

const COOKIE_ACCESS = 'aguia_admin_access';
const COOKIE_REFRESH = 'aguia_admin_refresh';
const COOKIE_CSRF = 'aguia_csrf';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function cookieOptions(maxAgeMs, { httpOnly = true } = {}) {
  const secure = process.env.COOKIE_SECURE !== 'false' && (isProduction() || process.env.COOKIE_SECURE === 'true');
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly,
    secure,
    sameSite: httpOnly ? 'strict' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function setAdminAuthCookies(res, { accessToken, refreshToken }) {
  const accessMs = parseExpiresMs(process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES || '1h');
  const refreshDays = parseInt(process.env.JWT_ADMIN_REFRESH_DAYS || '1', 10);
  const refreshMs = refreshDays * 24 * 60 * 60 * 1000;
  const csrf = crypto.randomBytes(24).toString('hex');

  res.cookie(COOKIE_ACCESS, accessToken, cookieOptions(accessMs, { httpOnly: true }));
  res.cookie(COOKIE_REFRESH, refreshToken, cookieOptions(refreshMs, { httpOnly: true }));
  res.cookie(COOKIE_CSRF, csrf, cookieOptions(refreshMs, { httpOnly: false }));
}

function clearAdminAuthCookies(res) {
  const opts = cookieOptions(null, { httpOnly: true });
  res.clearCookie(COOKIE_ACCESS, opts);
  res.clearCookie(COOKIE_REFRESH, opts);
  res.clearCookie(COOKIE_CSRF, { ...opts, httpOnly: false });
}

function getAdminTokensFromRequest(req) {
  const cookies = parseCookies(req);
  return {
    accessToken: cookies[COOKIE_ACCESS] || null,
    refreshToken: cookies[COOKIE_REFRESH] || null,
    csrfToken: cookies[COOKIE_CSRF] || null,
  };
}

function parseExpiresMs(value) {
  const match = String(value).match(/^(\d+)([smhd])?$/i);
  if (!match) return 3600_000;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3600_000, d: 86400_000 };
  return amount * (multipliers[unit] || 1000);
}

module.exports = {
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_CSRF,
  setAdminAuthCookies,
  clearAdminAuthCookies,
  getAdminTokensFromRequest,
  parseCookies,
};
