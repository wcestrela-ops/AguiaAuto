const { getFinanceiroService } = require('../../services/financeiro-service');
const { emitBillingPaymentUpdated } = require('../../infrastructure/websocket');
const { getRedis, isRedisEnabled } = require('../../infrastructure/redis');

async function rememberLastWebhook(provider, event) {
  if (!isRedisEnabled()) return;
  const redis = await getRedis();
  await redis.set(
    'ops:last-webhook',
    JSON.stringify({ provider, event, at: new Date().toISOString() }),
    'EX',
    86400 * 7,
  );
}

async function processBillingWebhook(job) {
  const { provider, event, payment } = job.data;
  const result = await getFinanceiroService().processWebhookEvent({ provider, event, payment });
  await rememberLastWebhook(provider, event);
  emitBillingPaymentUpdated({ provider, event, payment, result });
  return result;
}

module.exports = { processBillingWebhook };
