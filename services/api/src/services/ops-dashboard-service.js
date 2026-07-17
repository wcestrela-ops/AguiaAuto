const { getHealthReport } = require('../infrastructure/health-service');
const { getAllQueueStats } = require('../infrastructure/queues');
const { getWsStats } = require('../infrastructure/websocket');
const { isRedisEnabled, getRedis } = require('../infrastructure/redis');
const { getPool } = require('../db/pool');

async function getLastBackupInfo() {
  if (!isRedisEnabled()) return null;
  const redis = await getRedis();
  const raw = await redis.get('ops:last-backup');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { at: raw };
  }
}

async function getLastWebhookInfo() {
  if (!isRedisEnabled()) return null;
  const redis = await getRedis();
  const raw = await redis.get('ops:last-webhook');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function countFailedJobs() {
  const stats = await getAllQueueStats().catch(() => ({}));
  let failed = 0;
  let active = 0;
  for (const queueStats of Object.values(stats || {})) {
    failed += queueStats?.failed || 0;
    active += queueStats?.active || 0;
  }
  return { failed, active };
}

async function getOpsDashboard() {
  const [health, queues, ws, lastBackup, lastWebhook, jobCounts] = await Promise.all([
    getHealthReport(),
    getAllQueueStats().catch(() => ({})),
    Promise.resolve(getWsStats()),
    getLastBackupInfo(),
    getLastWebhookInfo(),
    countFailedJobs(),
  ]);

  let recentFailedCommands = [];
  if (process.env.DATABASE_URL) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, vehicle_id, action, state, status, error_message, created_at
       FROM vehicle_command_logs
       WHERE COALESCE(state, status) IN ('FAILED', 'failed')
       ORDER BY created_at DESC
       LIMIT 10`,
    );
    recentFailedCommands = rows;
  }

  return {
    generated_at: new Date().toISOString(),
    health,
    websocket: ws,
    queues,
    jobs: jobCounts,
    last_backup: lastBackup,
    last_webhook: lastWebhook,
    recent_failed_commands: recentFailedCommands,
  };
}

module.exports = { getOpsDashboard };
