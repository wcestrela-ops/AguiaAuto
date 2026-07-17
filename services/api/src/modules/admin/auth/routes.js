const { Router } = require('express');
const { getAdminAuthService } = require('../../../services/admin-auth-service');
const { getTwoFactorService } = require('../../../services/two-factor-service');
const { createRateLimiter } = require('../../../middleware/rate-limit');
const adminAuth = require('../../../middleware/admin-auth');
const {
  setAdminAuthCookies,
  clearAdminAuthCookies,
  getAdminTokensFromRequest,
} = require('../../../lib/security/cookie-auth');

const router = Router();

const adminLoginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_ADMIN_LOGIN || '8', 10),
  keyFn: (req) => `admin-login:${req.ip}:${req.body?.email || ''}`,
});

const adminRefreshLimiter = createRateLimiter({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_ADMIN_REFRESH || '20', 10),
  keyFn: (req) => `admin-refresh:${req.ip}`,
});

function sendAuthResponse(res, data) {
  if (data?.access_token && data?.refresh_token) {
    setAdminAuthCookies(res, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });
  }
  const { access_token, refresh_token, ...safeData } = data;
  res.json({
    success: true,
    data: {
      ...safeData,
      cookie_auth: Boolean(access_token && refresh_token),
    },
  });
}

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const data = await getAdminAuthService().login(req.body || {}, req);
    if (data.requires_2fa || data.requires_2fa_setup) {
      return res.json({ success: true, data });
    }
    sendAuthResponse(res, data);
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: err.message, requestId: req.requestId },
    });
  }
});

router.post('/refresh', adminRefreshLimiter, async (req, res) => {
  try {
    const cookies = getAdminTokensFromRequest(req);
    const refreshToken = req.body?.refresh_token || cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'refresh_token é obrigatório.', requestId: req.requestId },
      });
    }
    const data = await getAdminAuthService().refresh(refreshToken, req);
    sendAuthResponse(res, data);
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'REFRESH_FAILED', message: err.message, requestId: req.requestId },
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const cookies = getAdminTokensFromRequest(req);
    await getAdminAuthService().logout(req.body?.refresh_token || cookies.refreshToken);
    clearAdminAuthCookies(res);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/csrf', (req, res) => {
  const { csrfToken } = getAdminTokensFromRequest(req);
  res.json({ success: true, data: { csrf_token: csrfToken } });
});

router.get('/me', adminAuth, async (req, res) => {
  try {
    const data = await getAdminAuthService().getMe(req.admin.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.post('/2fa/setup', adminAuth, async (req, res) => {
  try {
    const data = await getTwoFactorService().setup(req.admin.id, req.admin.email);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/2fa/verify', adminAuth, async (req, res) => {
  try {
    const data = await getTwoFactorService().verifySetup(req.admin.id, req.body?.code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/2fa/disable', adminAuth, async (req, res) => {
  try {
    const data = await getTwoFactorService().disable(req.admin.id, req.body?.code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
