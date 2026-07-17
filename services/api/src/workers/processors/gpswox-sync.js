const { getGpswoxSyncService } = require('../../services/gpswox-sync-service');
const { withLock } = require('../../infrastructure/distributed-lock');

async function processGpswoxSync(job) {
  const provider = job.data?.provider || null;
  return withLock(`gpswox-sync:${provider || 'all'}`, async () => {
    const service = getGpswoxSyncService();
    if (provider) {
      return service.syncAndAudit({ provider, dryRun: false });
    }
    return service.runScheduledSync();
  }, 3600);
}

module.exports = { processGpswoxSync };
