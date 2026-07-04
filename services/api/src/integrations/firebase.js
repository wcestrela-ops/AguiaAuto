const { getStore } = require('@aguia/integrations');

async function getConfig() {
  const store = getStore();
  return store.getSettings('firebase');
}

module.exports = {
  getConfig,
  sendPush: async () => ({ status: 'not_implemented' }),
};
