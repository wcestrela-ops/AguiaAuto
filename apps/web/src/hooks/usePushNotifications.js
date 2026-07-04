import { useState, useEffect, useCallback } from 'react';
import {
  requestFcmToken,
  registerFcmWithServer,
  unregisterFcmFromServer,
  onForegroundMessage,
  initFirebaseMessaging,
} from '../lib/firebase';
import { api } from '../api/client';

const STORAGE_KEY = 'fcm_token';

export function usePushNotifications() {
  const [status, setStatus] = useState('idle'); // idle | loading | enabled | denied | error
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);

  const loadDevices = useCallback(async () => {
    try {
      const res = await api.getFcmDevices();
      setDevices(res.data);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'Águia';
      const body = payload.notification?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });
    return unsubscribe;
  }, []);

  async function enablePush() {
    setStatus('loading');
    setError('');
    try {
      await initFirebaseMessaging();
      const token = await requestFcmToken();
      await registerFcmWithServer(token);
      localStorage.setItem(STORAGE_KEY, token);
      setStatus('enabled');
      await loadDevices();
    } catch (err) {
      setStatus(err.message.includes('negada') ? 'denied' : 'error');
      setError(err.message);
    }
  }

  async function disablePush() {
    setStatus('loading');
    setError('');
    try {
      const token = localStorage.getItem(STORAGE_KEY);
      if (token) {
        await unregisterFcmFromServer(token);
        localStorage.removeItem(STORAGE_KEY);
      }
      setStatus('idle');
      await loadDevices();
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  async function sendTestPush() {
    setError('');
    try {
      await api.testPushNotification();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return {
    status,
    error,
    devices,
    enablePush,
    disablePush,
    sendTestPush,
    loadDevices,
    isEnabled: status === 'enabled' || devices.length > 0,
  };
}
