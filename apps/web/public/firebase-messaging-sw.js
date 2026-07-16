/* eslint-disable no-undef */
// Service Worker para Firebase Cloud Messaging (Web Push)
// Config carregada dinamicamente do painel admin via API

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

async function initFirebase() {
  try {
    const response = await fetch('/api/v1/config/firebase');
    const json = await response.json();
    if (!json.success || !json.data) return;

    const cfg = json.data;
    firebase.initializeApp({
      apiKey: cfg.api_key,
      authDomain: `${cfg.project_id}.firebaseapp.com`,
      projectId: cfg.project_id,
      messagingSenderId: cfg.messaging_sender_id,
      appId: cfg.app_id,
    });

    messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || 'Águia Gestão Veicular';
      const options = {
        body: payload.notification?.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: payload.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (err) {
    console.error('[FCM SW] Erro ao inicializar:', err);
  }
}

initFirebase();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.path || '/app';
  event.waitUntil(clients.openWindow(path));
});
