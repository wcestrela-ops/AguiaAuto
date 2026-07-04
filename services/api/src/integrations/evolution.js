const { getStore } = require('@aguia/integrations');

async function getConfig() {
  const store = getStore();
  return store.getSettings('evolution');
}

module.exports = {
  getConfig,
  sendWelcome: async () => ({ status: 'not_implemented' }),
  sendAlert: async () => ({ status: 'not_implemented' }),
  sendBillingReminder: async () => ({ status: 'not_implemented' }),
};
