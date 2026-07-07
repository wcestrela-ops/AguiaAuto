import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { api } from '../api/client';

let app = null;
let messaging = null;
let cachedConfig = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const res = await api.getFirebasePublicConfig();
  cachedConfig = res.data;
  return cachedConfig;
}

export async function initFirebaseMessaging() {
  const supported = await isSupported();
  if (!supported) {
    throw new Error('Push notifications não suportadas neste navegador.');
  }

  const cfg = await loadConfig();

  if (!cfg.vapid_key) {
    throw new Error('VAPID Key não configurada. Configure no painel admin → Integrações → Firebase.');
  }

  app = initializeApp({
    apiKey: cfg.api_key,
    authDomain: `${cfg.project_id}.firebaseapp.com`,
    projectId: cfg.project_id,
    messagingSenderId: cfg.messaging_sender_id,
    appId: cfg.app_id,
  });

  messaging = getMessaging(app);
  return messaging;
}

export async function requestFcmToken() {
  const msg = messaging || await initFirebaseMessaging();
  const cfg = await loadConfig();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificação negada.');
  }

  const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(msg, {
    vapidKey: cfg.vapid_key,
    serviceWorkerRegistration: swRegistration,
  });

  if (!token) {
    throw new Error('Não foi possível obter o token FCM.');
  }

  return token;
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

export async function registerFcmWithServer(token) {
  return api.registerFcmToken({
    token,
    platform: 'web',
    device_name: navigator.userAgent.slice(0, 200),
  });
}

export async function unregisterFcmFromServer(token) {
  return api.unregisterFcmToken(token);
}
