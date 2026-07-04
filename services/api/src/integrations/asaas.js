const { getStore } = require('@aguia/integrations');

async function getConfig() {
  const store = getStore();
  return store.getSettings('asaas');
}

module.exports = {
  getConfig,
  createCustomer: async () => ({ status: 'not_implemented' }),
  createSubscription: async () => ({ status: 'not_implemented' }),
  handleWebhook: async () => ({ status: 'not_implemented' }),
};
