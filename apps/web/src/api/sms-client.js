const SMS_BASE = import.meta.env.VITE_SMS_API_URL || '/api/v1/sms';

class SmsApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('sms_hub_access') || '';
    this.refreshToken = localStorage.getItem('sms_hub_refresh') || '';
  }

  setTokens(data) {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    localStorage.setItem('sms_hub_access', data.access_token);
    localStorage.setItem('sms_hub_refresh', data.refresh_token);
    localStorage.setItem('sms_hub_user', JSON.stringify(data.user));
  }

  clearTokens() {
    this.accessToken = '';
    this.refreshToken = '';
    localStorage.removeItem('sms_hub_access');
    localStorage.removeItem('sms_hub_refresh');
    localStorage.removeItem('sms_hub_user');
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('sms_hub_user') || 'null');
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    return Boolean(this.accessToken || localStorage.getItem('sms_hub_access'));
  }

  async request(path, options = {}, retry = true) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const response = await fetch(`${SMS_BASE}${path}`, { ...options, headers });
    const json = await response.json().catch(() => null);

    if (response.status === 401 && retry && this.refreshToken && path !== '/auth/refresh') {
      await this.refreshAccessToken();
      return this.request(path, options, false);
    }

    if (!response.ok) {
      throw new Error(json?.error?.message || json?.message || `Erro ${response.status}`);
    }

    return json;
  }

  async refreshAccessToken() {
    const response = await fetch(`${SMS_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
    const json = await response.json();
    if (!response.ok) {
      this.clearTokens();
      throw new Error(json?.error?.message || 'Sessão SMS expirada');
    }
    this.setTokens(json.data);
  }

  async bridgeFromAguiaAdmin(aguiaAdminToken) {
    const response = await fetch(`${SMS_BASE}/auth/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aguia-Admin-Token': aguiaAdminToken,
      },
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message || 'Falha ao conectar módulo AG SMS');
    }
    this.setTokens(json.data);
    return json.data;
  }

  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((res) => {
      this.setTokens(res.data);
      return res.data;
    });
  }

  logout() {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    }).finally(() => this.clearTokens());
  }

  dashboard() {
    return this.request('/dashboard');
  }
}

export const smsApi = new SmsApiClient();
