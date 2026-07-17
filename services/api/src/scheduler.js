require('dotenv').config();

const logger = require('./logger');
const { isRedisEnabled, getRedis } = require('./infrastructure/redis');
const { enqueue, QUEUE_NAMES } = require('./infrastructure/queues');
const { getPool } = require('./db/pool');
const { startAnchorPoller } = require('./services/anchor-service');
const { startReferralRewardPoller } = require('./services/referral-service');
const { startBillingReminderPoller } = require('./services/billing-reminder-service');
const { startFleetReminderPoller } = require('./services/fleet-reminder-service');
const { getGpswoxSyncService } = require('./services/gpswox-sync-service');
const { countVehicleViewers, resolvePollIntervalMs } = require('./infrastructure/presence');
const { getLastPosition } = require('./infrastructure/tracking-cache');

const timers = [];

async function scheduleTrackingRefresh() {
  if (!isRedisEnabled() || !process.env.DATABASE_URL) return;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, status, tracking_provider
     FROM vehicles
     WHERE tracker_device_id IS NOT NULL
       AND status IN ('active', 'blocked')
     ORDER BY updated_at DESC
     LIMIT 500`,
  );

  for (const vehicle of rows) {
    const viewers = await countVehicleViewers(String(vehicle.id));
    const cached = await getLastPosition(String(vehicle.id), vehicle.tenant_id);
    const online = cached?.online ?? null;
    const intervalMs = resolvePollIntervalMs({ viewers, online });
    const lastUpdate = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
    if (Date.now() - lastUpdate < intervalMs) continue;

    await enqueue(
      QUEUE_NAMES.TRACKING_POSITION,
      'refresh',
      { vehicleDbId: vehicle.id, provider: vehicle.tracking_provider, tenantId: vehicle.tenant_id ?? 1 },
      { jobId: `pos-${vehicle.id}-${Math.floor(Date.now() / intervalMs)}`, removeOnComplete: true },
    );
  }
}

async function runProviderMonitor() {
  const gatewayUrl = process.env.GATEWAY_URL;
  if (!gatewayUrl) return;
  try {
    await fetch(`${gatewayUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    logger.warn('Monitor gateway falhou.', { err: err.message });
  }
}

async function runCacheCleanup() {
  if (!isRedisEnabled()) return;
  const redis = await getRedis();
  const keys = await redis.keys('tracking:last-position:*');
  if (keys.length > 10000) {
    logger.info('Limpeza de cache de posição.', { keys: keys.length });
  }
}

function startScheduler() {
  if (!process.env.DATABASE_URL) {
    logger.warn('Scheduler sem DATABASE_URL — tarefas DB desabilitadas.');
    return timers;
  }

  timers.push(startAnchorPoller(parseInt(process.env.ANCORA_POLL_MS || '30000', 10)));
  timers.push(startReferralRewardPoller(parseInt(process.env.REFERRAL_POLL_MS || '60000', 10)));
  timers.push(startBillingReminderPoller(
    parseInt(process.env.BILLING_REMINDER_CHECK_MS || '0', 10) || undefined,
  ));
  timers.push(startFleetReminderPoller(
    parseInt(process.env.FLEET_REMINDER_CHECK_MS || '0', 10) || undefined,
  ));

  const syncCheckMs = parseInt(process.env.GPSWOX_SYNC_CHECK_MS || '900000', 10);
  timers.push(setInterval(async () => {
    try {
      if (isRedisEnabled()) {
        await enqueue(QUEUE_NAMES.GPSWOX_SYNC, 'scheduled', { trigger: 'scheduler' });
      } else {
        await getGpswoxSyncService().runScheduledSync();
      }
    } catch (err) {
      logger.warn('Scheduler sync falhou.', { err: err.message });
    }
  }, syncCheckMs));

  const trackingRefreshMs = parseInt(process.env.TRACKING_SCHEDULER_MS || '15000', 10);
  timers.push(setInterval(() => {
    scheduleTrackingRefresh().catch((err) => {
      logger.warn('Scheduler tracking refresh falhou.', { err: err.message });
    });
  }, trackingRefreshMs));

  timers.push(setInterval(runProviderMonitor, parseInt(process.env.PROVIDER_MONITOR_MS || '60000', 10)));
  timers.push(setInterval(runCacheCleanup, parseInt(process.env.CACHE_CLEANUP_MS || '3600000', 10)));

  logger.info('Scheduler AguiaAuto iniciado.');
  return timers;
}

function stopScheduler() {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
}

if (require.main === module) {
  startScheduler();
  process.on('SIGTERM', () => {
    stopScheduler();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    stopScheduler();
    process.exit(0);
  });
}

module.exports = { startScheduler, stopScheduler, scheduleTrackingRefresh };
