require('dotenv').config();

const logger = require('./logger');
const { isRedisEnabled } = require('./infrastructure/redis');
const { createWorker, QUEUE_NAMES, closeQueues } = require('./infrastructure/queues');
const { closeRedis } = require('./infrastructure/redis');
const { processTrackingPosition } = require('./workers/processors/tracking-position');
const { processTrackingCommand } = require('./workers/processors/tracking-command');
const { processNotification } = require('./workers/processors/notifications');
const { processBillingWebhook } = require('./workers/processors/billing-webhook');
const { processGpswoxSync } = require('./workers/processors/gpswox-sync');
const { processCustomerProvisioning } = require('./workers/processors/customer-provisioning');
const { processContractGeneration } = require('./workers/processors/contract-generation');

const workers = [];

function startWorkers() {
  if (!isRedisEnabled()) {
    logger.warn('Worker não iniciado — REDIS_URL ausente.');
    return [];
  }

  const definitions = [
    { name: QUEUE_NAMES.TRACKING_POSITION, processor: processTrackingPosition, concurrency: 10 },
    { name: QUEUE_NAMES.TRACKING_COMMAND, processor: processTrackingCommand, concurrency: 5 },
    { name: QUEUE_NAMES.NOTIFICATIONS, processor: processNotification, concurrency: 8 },
    { name: QUEUE_NAMES.CUSTOMER_PROVISIONING, processor: processCustomerProvisioning, concurrency: 3 },
    { name: QUEUE_NAMES.BILLING_WEBHOOK, processor: processBillingWebhook, concurrency: 5 },
    { name: QUEUE_NAMES.GPSWOX_SYNC, processor: processGpswoxSync, concurrency: 1 },
    { name: QUEUE_NAMES.CONTRACT_GENERATION, processor: processContractGeneration, concurrency: 2 },
  ];

  for (const def of definitions) {
    const worker = createWorker(def.name, def.processor, { concurrency: def.concurrency });
    if (!worker) continue;

    worker.on('completed', (job) => {
      logger.info('Job concluído.', { queue: def.name, jobId: job.id, name: job.name });
    });
    worker.on('failed', (job, err) => {
      logger.error('Job falhou.', { queue: def.name, jobId: job?.id, err: err.message });
    });

    workers.push(worker);
    logger.info(`Worker ativo: ${def.name}`);
  }

  return workers;
}

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()));
  await closeQueues();
  await closeRedis();
}

if (require.main === module) {
  startWorkers();
  logger.info('Processo worker AguiaAuto iniciado.');

  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });
}

module.exports = { startWorkers, shutdown };
