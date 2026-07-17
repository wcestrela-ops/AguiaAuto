const { Queue, Worker } = require('bullmq');
const { isRedisEnabled } = require('./redis');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const QUEUE_NAMES = {
  TRACKING_POSITION: 'tracking-position',
  TRACKING_COMMAND: 'tracking-command',
  NOTIFICATIONS: 'notifications',
  CUSTOMER_PROVISIONING: 'customer-provisioning',
  BILLING_WEBHOOK: 'billing-webhook',
  GPSWOX_SYNC: 'gpswox-sync',
  CONTRACT_GENERATION: 'contract-generation',
};

const queues = new Map();

function getRedisConnection() {
  if (!isRedisEnabled()) return null;
  return { url: process.env.REDIS_URL };
}

function getQueue(name) {
  if (!isRedisEnabled()) return null;
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }));
  }
  return queues.get(name);
}

function createWorker(name, processor, options = {}) {
  if (!isRedisEnabled()) return null;
  return new Worker(name, processor, {
    connection: getRedisConnection(),
    concurrency: options.concurrency || 5,
  });
}

async function enqueue(name, jobName, data, options = {}) {
  const queue = getQueue(name);
  if (!queue) return null;
  const payload = {
    tenantId: data?.tenantId ?? data?.tenant_id ?? DEFAULT_TENANT_ID,
    ...data,
  };
  return queue.add(jobName, payload, options);
}

async function getQueueStats(name) {
  const queue = getQueue(name);
  if (!queue) return null;
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

async function getAllQueueStats() {
  const stats = {};
  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }
  return stats;
}

async function closeQueues() {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

module.exports = {
  QUEUE_NAMES,
  getQueue,
  createWorker,
  enqueue,
  getQueueStats,
  getAllQueueStats,
  closeQueues,
};
