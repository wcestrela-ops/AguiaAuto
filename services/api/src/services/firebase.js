const { getStore } = require('@aguia/integrations');
const logger = require('../logger');

let adminApp = null;

async function getConfig() {
  const store = getStore();
  return store.getSettings('firebase');
}

async function getPublicConfig() {
  const config = await getConfig();
  return {
    project_id: config.project_id,
    api_key: config.web_api_key,
    messaging_sender_id: config.messaging_sender_id,
    app_id: config.app_id,
    vapid_key: config.vapid_key,
  };
}

async function getAdminApp() {
  if (adminApp) return adminApp;

  const config = await getConfig();
  if (!config.project_id || !config.client_email || !config.private_key) {
    throw new Error('Firebase: configure project_id, client_email e private_key no painel admin.');
  }

  const admin = require('firebase-admin');
  const privateKey = String(config.private_key).replace(/\\n/g, '\n');

  if (admin.apps.length) {
    adminApp = admin.app();
    return adminApp;
  }

  adminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.project_id,
      clientEmail: config.client_email,
      privateKey,
    }),
  });

  return adminApp;
}

async function sendPush({ token, title, body, data = {} }) {
  const app = await getAdminApp();
  const start = Date.now();

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  };

  const result = await app.messaging().send(message);
  logger.info('Push Firebase enviado.', { title, responseTime: Date.now() - start });

  return { success: true, message_id: result };
}

async function testConnection() {
  const config = await getConfig();
  const required = ['project_id', 'web_api_key', 'messaging_sender_id', 'app_id', 'client_email', 'private_key'];
  const missing = required.filter(k => !config[k]);

  if (missing.length) {
    throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
  }

  await getAdminApp();
  return {
    success: true,
    message: `Firebase configurado — projeto ${config.project_id}.`,
    status: 'connected',
  };
}

module.exports = {
  getConfig,
  getPublicConfig,
  sendPush,
  testConnection,
};
