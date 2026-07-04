const BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  constructor() {
    this.adminToken = localStorage.getItem('admin_token') || '';
    this.accessToken = localStorage.getItem('access_token') || '';
    this.refreshToken = localStorage.getItem('refresh_token') || '';
  }

  // ─── Admin ───────────────────────────────────────────────────────────────
  setAdminToken(token) {
    this.adminToken = token;
    localStorage.setItem('admin_token', token);
  }

  clearAdminToken() {
    this.adminToken = '';
    localStorage.removeItem('admin_token');
  }

  get token() {
    return this.adminToken;
  }

  setToken(token) {
    this.setAdminToken(token);
  }

  clearToken() {
    this.clearAdminToken();
  }

  // ─── Cliente JWT ─────────────────────────────────────────────────────────
  setClientTokens({ access_token, refresh_token }) {
    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
  }

  clearClientTokens() {
    this.accessToken = '';
    this.refreshToken = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  isClientLoggedIn() {
    return Boolean(this.accessToken || localStorage.getItem('access_token'));
  }

  async request(path, options = {}, { useAdmin = false, useClient = false, retry = true } = {}) {
    const token = useAdmin ? this.adminToken : useClient ? this.accessToken : this.adminToken;

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => null);

    if (response.status === 401 && useClient && retry && this.refreshToken && data?.error?.includes('expirado')) {
      await this.refreshAccessToken();
      return this.request(path, options, { useAdmin, useClient, retry: false });
    }

    if (!response.ok) {
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    return data;
  }

  async refreshAccessToken() {
    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
    const data = await response.json();
    if (!response.ok) {
      this.clearClientTokens();
      throw new Error(data?.error || 'Sessão expirada.');
    }
    this.setClientTokens(data.data);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    return data.data;
  }

  // ─── Auth Cliente ────────────────────────────────────────────────────────
  login(email, password) {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, { useClient: false }).then((res) => {
      this.setClientTokens(res.data);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return res;
    });
  }

  register(payload) {
    return this.request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((res) => {
      this.setClientTokens(res.data);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return res;
    });
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await fetch(`${BASE}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
      }
    } finally {
      this.clearClientTokens();
    }
  }

  getMe() {
    return this.request('/v1/auth/me', {}, { useClient: true });
  }

  getDashboard() {
    return this.request('/v1/dashboard', {}, { useClient: true });
  }

  getPerfil() {
    return this.request('/v1/perfil', {}, { useClient: true });
  }

  updatePerfil(data) {
    return this.request('/v1/perfil', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useClient: true });
  }

  changePassword(current_password, new_password) {
    return this.request('/v1/perfil/senha', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }, { useClient: true });
  }

  // ─── Admin ───────────────────────────────────────────────────────────────
  getIntegrations() {
    return this.request('/v1/admin/integracoes', {}, { useAdmin: true });
  }

  getIntegration(key) {
    return this.request(`/v1/admin/integracoes/${key}`, {}, { useAdmin: true });
  }

  saveIntegration(key, settings, enabled = true) {
    return this.request(`/v1/admin/integracoes/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ settings, enabled }),
    }, { useAdmin: true });
  }

  testIntegration(key) {
    return this.request(`/v1/admin/integracoes/${key}/test`, { method: 'POST' }, { useAdmin: true });
  }

  getWhatsAppProviders() {
    return this.request('/v1/admin/whatsapp', {}, { useAdmin: true });
  }

  getWhatsAppTypes() {
    return this.request('/v1/admin/whatsapp/types', {}, { useAdmin: true });
  }

  createWhatsAppProvider(data) {
    return this.request('/v1/admin/whatsapp', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateWhatsAppProvider(id, data) {
    return this.request(`/v1/admin/whatsapp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  setWhatsAppPrimary(id) {
    return this.request(`/v1/admin/whatsapp/${id}/primary`, { method: 'PUT' }, { useAdmin: true });
  }

  setWhatsAppBackup(id) {
    return this.request(`/v1/admin/whatsapp/${id}/backup`, { method: 'PUT' }, { useAdmin: true });
  }

  testWhatsApp(id) {
    return this.request(`/v1/admin/whatsapp/${id}/test`, { method: 'POST' }, { useAdmin: true });
  }

  deleteWhatsApp(id) {
    return this.request(`/v1/admin/whatsapp/${id}`, { method: 'DELETE' }, { useAdmin: true });
  }

  getFirebasePublicConfig() {
    return this.request('/v1/config/firebase');
  }
}

export const api = new ApiClient();
