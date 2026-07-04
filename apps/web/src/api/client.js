const BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('admin_token') || '';
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('admin_token', token);
  }

  clearToken() {
    this.token = '';
    localStorage.removeItem('admin_token');
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    return data;
  }

  getIntegrations() {
    return this.request('/v1/admin/integracoes');
  }

  getIntegration(key) {
    return this.request(`/v1/admin/integracoes/${key}`);
  }

  saveIntegration(key, settings, enabled = true) {
    return this.request(`/v1/admin/integracoes/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ settings, enabled }),
    });
  }

  testIntegration(key) {
    return this.request(`/v1/admin/integracoes/${key}/test`, { method: 'POST' });
  }

  getWhatsAppProviders() {
    return this.request('/v1/admin/whatsapp');
  }

  getWhatsAppTypes() {
    return this.request('/v1/admin/whatsapp/types');
  }

  createWhatsAppProvider(data) {
    return this.request('/v1/admin/whatsapp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateWhatsAppProvider(id, data) {
    return this.request(`/v1/admin/whatsapp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  setWhatsAppPrimary(id) {
    return this.request(`/v1/admin/whatsapp/${id}/primary`, { method: 'PUT' });
  }

  setWhatsAppBackup(id) {
    return this.request(`/v1/admin/whatsapp/${id}/backup`, { method: 'PUT' });
  }

  testWhatsApp(id) {
    return this.request(`/v1/admin/whatsapp/${id}/test`, { method: 'POST' });
  }

  deleteWhatsApp(id) {
    return this.request(`/v1/admin/whatsapp/${id}`, { method: 'DELETE' });
  }

  getFirebasePublicConfig() {
    return this.request('/v1/config/firebase');
  }
}

export const api = new ApiClient();
