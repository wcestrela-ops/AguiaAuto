const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getSessionRepository } = require('../../../repositories/session-repository');
const { getLoginAttemptRepository } = require('../../../repositories/login-attempt-repository');
const { getAdminUserRepository } = require('../../../repositories/admin-user-repository');
const { getPool } = require('../../../db/pool');

const router = Router();

router.get('/dashboard', adminAuth, requirePermission('security.view'), async (req, res) => {
  try {
    const pool = getPool();
    const since24h = "NOW() - INTERVAL '24 hours'";

    const [
      loginSuccess,
      loginFailed,
      lockedUsers,
      activeSessions,
      adminsWithout2FA,
      rejectedWebhooks,
      criticalCommands,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM login_attempts WHERE success = true AND session_type = 'admin' AND created_at >= ${since24h}`),
      pool.query(`SELECT COUNT(*)::int AS count FROM login_attempts WHERE success = false AND session_type = 'admin' AND created_at >= ${since24h}`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE locked_until > NOW()`),
      pool.query(`SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE revoked = false AND expires_at > NOW() AND session_type = 'admin'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role IN ('superadmin','admin','financeiro') AND two_factor_enabled = false AND active = true`),
      pool.query(`SELECT COUNT(*)::int AS count FROM webhook_events WHERE status = 'failed' AND created_at >= ${since24h}`),
      pool.query(`SELECT COUNT(*)::int AS count FROM vehicle_command_logs WHERE COALESCE(state, status) IN ('FAILED','failed','SENT','CONFIRMED') AND created_at >= ${since24h}`),
    ]);

    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        logins_24h: loginSuccess.rows[0].count,
        login_failures_24h: loginFailed.rows[0].count,
        locked_users: lockedUsers.rows[0].count,
        active_admin_sessions: activeSessions.rows[0].count,
        admins_without_2fa: adminsWithout2FA.rows[0].count,
        rejected_webhooks_24h: rejectedWebhooks.rows[0].count,
        critical_commands_24h: criticalCommands.rows[0].count,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sessions', adminAuth, requirePermission('security.manage'), async (req, res) => {
  try {
    const sessions = await getSessionRepository().listActiveSessions(req.admin.id, 'admin');
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/sessions/:id', adminAuth, requirePermission('security.manage'), async (req, res) => {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true
       WHERE id = $1 AND user_id = $2 AND session_type = 'admin'`,
      [req.params.id, req.admin.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sessions/revoke-others', adminAuth, requirePermission('security.manage'), async (req, res) => {
  try {
    const refreshToken = req.body?.refresh_token;
    const hash = refreshToken ? getSessionRepository().hashToken(refreshToken) : '__none__';
    await getSessionRepository().revokeAllExcept(req.admin.id, hash, 'admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/login-attempts', adminAuth, requirePermission('security.view'), async (req, res) => {
  try {
    const data = await getLoginAttemptRepository().listRecent({
      limit: parseInt(req.query.limit || '50', 10),
      sessionType: 'admin',
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admins', adminAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const data = await getAdminUserRepository().listAdmins();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
