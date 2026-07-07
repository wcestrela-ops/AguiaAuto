const { getStore } = require('@aguia/integrations');
const { getFcmTokenRepository } = require('../repositories/fcm-token-repository');
const logger = require('../logger');

let adminApp = null;

async function getConfig() {
  const store = getStore();
  return store.getSettings('firebase');
}

async function getPublicConfig() {
  const config = await getConfig();
  const required = ['project_id', 'web_api_key', 'messaging_sender_id', 'app_id'];
  const missing = required.filter(k => !config[k]);
  if (missing.length) {
    throw new Error(`Firebase incompleto: ${missing.join(', ')}`);
  }

  return {
    project_id: config.project_id,
    api_key: config.web_api_key,
    messaging_sender_id: config.messaging_sender_id,
    app_id: config.app_id,
    vapid_key: config.vapid_key || null,
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
    webpush: {
      notification: { title, body, icon: '/favicon.svg' },
    },
  };

  const result = await app.messaging().send(message);
  logger.info('Push Firebase enviado.', { title, responseTime: Date.now() - start });
  return { success: true, message_id: result };
}

async function sendPushToUser(userId, { title, body, data = {} }) {
  const fcmRepo = getFcmTokenRepository();
  const tokens = await fcmRepo.getActiveTokens(userId);

  if (tokens.length === 0) {
    throw new Error('Nenhum dispositivo registrado para push.');
  }

  const results = [];
  const errors = [];

  for (const token of tokens) {
    try {
      const result = await sendPush({ token, title, body, data });
      results.push({ token: token.slice(0, 12) + '...', ...result });
    } catch (err) {
      errors.push({ token: token.slice(0, 12) + '...', error: err.message });

      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        await fcmRepo.deactivateToken(token);
        logger.warn('FCM token inválido desativado.', { userId });
      }
    }
  }

  return {
    success: results.length > 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

async function registerToken(userId, { token, device_name, platform }) {
  if (!token || token.length < 20) {
    throw new Error('Token FCM inválido.');
  }
  const fcmRepo = getFcmTokenRepository();
  return fcmRepo.register({ userId, token, device_name, platform });
}

async function unregisterToken(userId, token) {
  const fcmRepo = getFcmTokenRepository();
  await fcmRepo.unregister(userId, token);
  return { success: true };
}

async function listDevices(userId) {
  const fcmRepo = getFcmTokenRepository();
  return fcmRepo.listByUser(userId);
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
  sendPushToUser,
  registerToken,
  unregisterToken,
  listDevices,
  testConnection,
};
