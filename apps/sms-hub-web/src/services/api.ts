const BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'COMPANY_USER';
  company_id: string | null;
  status: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  user: ApiUser;
}

class ApiClient {
  accessToken = localStorage.getItem('sms_hub_access') || '';
  refreshToken = localStorage.getItem('sms_hub_refresh') || '';

  setTokens(data: AuthTokens) {
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

  getUser(): ApiUser | null {
    try {
      return JSON.parse(localStorage.getItem('sms_hub_user') || 'null');
    } catch {
      return null;
    }
  }

  async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const response = await fetch(`${BASE}${path}`, { ...options, headers });
    const json = await response.json().catch(() => null);

    if (response.status === 401 && retry && this.refreshToken && path !== '/v1/auth/refresh') {
      await this.refreshAccessToken();
      return this.request(path, options, false);
    }

    if (!response.ok) {
      throw new Error(json?.error?.message || json?.message || `Erro ${response.status}`);
    }

    return json as T;
  }

  async refreshAccessToken() {
    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
    const json = await response.json();
    if (!response.ok) {
      this.clearTokens();
      throw new Error(json?.error?.message || 'Sessão expirada');
    }
    this.setTokens(json.data);
  }

  login(email: string, password: string) {
    return this.request<{ success: boolean; data: AuthTokens }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((res) => {
      this.setTokens(res.data);
      return res.data;
    });
  }

  logout() {
    return this.request('/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    }).finally(() => this.clearTokens());
  }

  me() {
    return this.request<{ success: boolean; data: ApiUser }>('/v1/auth/me');
  }

  dashboard() {
    return this.request<{ success: boolean; data: Record<string, unknown> }>('/v1/dashboard');
  }
}

export const api = new ApiClient();
