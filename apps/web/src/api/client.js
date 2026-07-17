const BASE = import.meta.env.VITE_API_URL || '/api';

const STORAGE_KEYS = {
  rememberMe: 'client_remember_me',
  savedEmail: 'client_saved_email',
  adminUser: 'admin_user',
};

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

class ApiClient {
  constructor() {
    this.adminToken = localStorage.getItem('admin_access_token') || localStorage.getItem('admin_token') || '';
    this.adminRefreshToken = localStorage.getItem('admin_refresh_token') || '';
    this.accessToken = localStorage.getItem('access_token') || '';
    this.refreshToken = localStorage.getItem('refresh_token') || '';
  }

  // ─── Admin ───────────────────────────────────────────────────────────────
  setAdminTokens({ access_token, refresh_token }) {
    this.adminToken = access_token;
    this.adminRefreshToken = refresh_token || '';
    localStorage.setItem('admin_access_token', access_token);
    if (refresh_token) localStorage.setItem('admin_refresh_token', refresh_token);
    localStorage.removeItem('admin_token');
  }

  setAdminToken(token) {
    this.adminToken = token;
    localStorage.setItem('admin_token', token);
  }

  clearAdminSession() {
    this.adminToken = '';
    this.adminRefreshToken = '';
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }

  clearAdminToken() {
    this.clearAdminSession();
  }

  get token() {
    return this.adminToken;
  }

  setToken(token) {
    this.setAdminToken(token);
  }

  clearToken() {
    this.clearAdminSession();
  }

  hasAdminSession() {
    return Boolean(
      readCookie('aguia_admin_access')
      || readCookie('aguia_csrf')
      || localStorage.getItem(STORAGE_KEYS.adminUser)
      || this.adminToken
      || localStorage.getItem('admin_access_token')
      || localStorage.getItem('admin_token'),
    );
  }

  async ensureAdminSession() {
    if (!this.hasAdminSession()) return null;
    try {
      const me = await this.request('/v1/admin/auth/me', {}, { useAdmin: true, retry: false });
      if (me?.data) localStorage.setItem(STORAGE_KEYS.adminUser, JSON.stringify(me.data));
      return me?.data || null;
    } catch {
      this.clearAdminSession();
      return null;
    }
  }

  getAdminCsrfToken() {
    return readCookie('aguia_csrf');
  }

  async adminLogin({ email, password, totp_code, recovery_code }) {
    const response = await fetch(`${BASE}/v1/admin/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, totpCode: totp_code, recoveryCode: recovery_code }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || 'Falha no login.');
    }
    const payload = data.data;
    if (payload?.access_token && payload?.refresh_token) {
      this.setAdminTokens({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
    }
    if (payload?.user) localStorage.setItem(STORAGE_KEYS.adminUser, JSON.stringify(payload.user));
    if (payload?.cookie_auth) {
      this.adminToken = '';
      this.adminRefreshToken = '';
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_token');
    }
    return payload;
  }

  async adminLogout() {
    await fetch(`${BASE}/v1/admin/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(this.getAdminCsrfToken() ? { 'X-CSRF-Token': this.getAdminCsrfToken() } : {}),
      },
      body: JSON.stringify({ refresh_token: this.adminRefreshToken || undefined }),
    }).catch(() => null);
    this.clearAdminSession();
  }

  async refreshAdminAccessToken() {
    const response = await fetch(`${BASE}/v1/admin/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: this.adminRefreshToken || localStorage.getItem('admin_refresh_token') || undefined,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || 'Sessão expirada.');
    if (data.data?.access_token) {
      this.setAdminTokens({
        access_token: data.data.access_token,
        refresh_token: data.data.refresh_token,
      });
    }
    if (data.data?.user) localStorage.setItem(STORAGE_KEYS.adminUser, JSON.stringify(data.data.user));
    return data.data;
  }

  getSecurityDashboard() {
    return this.request('/v1/admin/security/dashboard', {}, { useAdmin: true }).then((r) => r.data);
  }

  getAdminSessions() {
    return this.request('/v1/admin/security/sessions', {}, { useAdmin: true }).then((r) => r.data);
  }

  revokeAdminSession(id) {
    return this.request(`/v1/admin/security/sessions/${id}`, { method: 'DELETE' }, { useAdmin: true });
  }

  revokeOtherAdminSessions() {
    return this.request('/v1/admin/security/sessions/revoke-others', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: this.adminRefreshToken || undefined }),
    }, { useAdmin: true });
  }

  getAdminLoginAttempts() {
    return this.request('/v1/admin/security/login-attempts', {}, { useAdmin: true }).then((r) => r.data);
  }

  setupAdmin2fa() {
    return this.request('/v1/admin/auth/2fa/setup', { method: 'POST' }, { useAdmin: true }).then((r) => r.data);
  }

  verifyAdmin2fa(code) {
    return this.request('/v1/admin/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, { useAdmin: true }).then((r) => r.data);
  }

  // ─── Cliente JWT ─────────────────────────────────────────────────────────
  setClientTokens({ access_token, refresh_token }) {
    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
  }

  clearClientTokens({ keepRememberEmail = false } = {}) {
    const remember = keepRememberEmail && this.getRememberMePreference();
    const savedEmail = remember ? this.getSavedEmail() : '';

    this.accessToken = '';
    this.refreshToken = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('service_contract_accepted');

    if (remember && savedEmail) {
      this.setRememberMePreference(true, savedEmail);
    } else {
      localStorage.removeItem(STORAGE_KEYS.rememberMe);
      localStorage.removeItem(STORAGE_KEYS.savedEmail);
    }
  }

  setRememberMePreference(enabled, email = '') {
    localStorage.setItem(STORAGE_KEYS.rememberMe, enabled ? '1' : '0');
    if (enabled && email) {
      localStorage.setItem(STORAGE_KEYS.savedEmail, String(email).trim().toLowerCase());
    } else if (!enabled) {
      localStorage.removeItem(STORAGE_KEYS.savedEmail);
    }
  }

  getRememberMePreference() {
    return localStorage.getItem(STORAGE_KEYS.rememberMe) === '1';
  }

  getSavedEmail() {
    return localStorage.getItem(STORAGE_KEYS.savedEmail) || '';
  }

  isAccessTokenValid() {
    const token = this.accessToken || localStorage.getItem('access_token');
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return Boolean(token);
    return payload.exp * 1000 > Date.now() + 60_000;
  }

  hasClientSession() {
    return Boolean(
      this.refreshToken
      || localStorage.getItem('refresh_token')
      || this.accessToken
      || localStorage.getItem('access_token'),
    );
  }

  isClientLoggedIn() {
    return this.hasClientSession();
  }

  async ensureClientSession() {
    this.accessToken = localStorage.getItem('access_token') || '';
    this.refreshToken = localStorage.getItem('refresh_token') || '';

    if (!this.hasClientSession()) return null;
    if (this.isAccessTokenValid() && this.getStoredUser()?.id) {
      return this.getStoredUser();
    }
    if (!this.refreshToken) {
      this.clearClientTokens({ keepRememberEmail: true });
      return null;
    }

    try {
      const data = await this.refreshAccessToken();
      return data.user;
    } catch {
      this.clearClientTokens({ keepRememberEmail: true });
      return null;
    }
  }

  setServiceContractAccepted(accepted) {
    localStorage.setItem('service_contract_accepted', accepted ? '1' : '0');
  }

  isServiceContractAccepted() {
    return localStorage.getItem('service_contract_accepted') === '1';
  }

  getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  isInstallerLoggedIn() {
    if (!this.isClientLoggedIn()) return false;
    const role = this.getStoredUser().role;
    return role === 'installer' || role === 'admin';
  }

  setContractRequiredHandler(handler) {
    this._contractRequiredHandler = handler || null;
  }

  _emitContractRequired(message) {
    this.setServiceContractAccepted(false);
    if (this._contractRequiredHandler) {
      this._contractRequiredHandler(message);
      return;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      if (path.startsWith('/app') && path !== '/app/contratos') {
        const params = new URLSearchParams({ required: '1' });
        window.location.assign(`/app/contratos?${params.toString()}`);
      }
    }
  }

  _throwClientError(response, data, { useClient = false } = {}) {
    const code = data?.error;
    const message = data?.message || code || `Erro ${response.status}`;

    if (useClient && response.status === 403 && code === 'CONTRACT_REQUIRED') {
      this._emitContractRequired(message);
      const err = new Error(message);
      err.code = 'CONTRACT_REQUIRED';
      err.contractRequired = true;
      throw err;
    }

    const err = new Error(message);
    err.code = code;
    throw err;
  }

  async request(path, options = {}, { useAdmin = false, useClient = false, retry = true } = {}) {
    const legacyAdminToken = this.adminToken
      || localStorage.getItem('admin_access_token')
      || localStorage.getItem('admin_token');
    const token = useAdmin
      ? legacyAdminToken
      : useClient
        ? this.accessToken
        : legacyAdminToken;

    const csrfToken = useAdmin ? this.getAdminCsrfToken() : '';
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(useAdmin && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      credentials: useAdmin ? 'include' : options.credentials,
    });
    const data = await response.json().catch(() => null);

    if (response.status === 401 && useClient && retry && this.refreshToken) {
      await this.refreshAccessToken();
      return this.request(path, options, { useAdmin, useClient, retry: false });
    }

    if (response.status === 401 && useAdmin && retry) {
      try {
        await this.refreshAdminAccessToken();
        return this.request(path, options, { useAdmin, useClient, retry: false });
      } catch {
        this.clearAdminSession();
      }
    }

    if (!response.ok) {
      this._throwClientError(response, data, { useClient });
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
      this.clearClientTokens({ keepRememberEmail: true });
      throw new Error(data?.error || 'Sessão expirada.');
    }
    this.setClientTokens(data.data);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    if (data.data.remember_me != null) {
      this.setRememberMePreference(
        Boolean(data.data.remember_me),
        data.data.user?.email,
      );
    }
    return data.data;
  }

  // ─── Auth Cliente ────────────────────────────────────────────────────────
  login(email, password, { remember_me = true } = {}) {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember_me }),
    }, { useClient: false }).then((res) => {
      this.setClientTokens(res.data);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      this.setRememberMePreference(Boolean(remember_me), email);
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
      this.setRememberMePreference(true, res.data.user?.email || payload.email);
      return res;
    });
  }

  getOnboardingInfo() {
    return this.request('/v1/onboarding');
  }

  onboardingRegister(payload) {
    return this.request('/v1/onboarding/cadastro', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((res) => {
      this.setClientTokens(res.data);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      this.setRememberMePreference(true, res.data.user?.email || payload.email);
      if (res.data?.onboarding?.contract) {
        this.setServiceContractAccepted(true);
      }
      return res;
    });
  }

  async logout() {
    const keepRememberEmail = this.getRememberMePreference();
    const savedEmail = this.getSavedEmail();
    try {
      if (this.refreshToken) {
        await fetch(`${BASE}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
      }
    } finally {
      this.clearClientTokens({ keepRememberEmail });
      if (keepRememberEmail && savedEmail) {
        this.setRememberMePreference(true, savedEmail);
      }
    }
  }

  getMe() {
    return this.request('/v1/auth/me', {}, { useClient: true });
  }

  getDashboard() {
    return this.request('/v1/dashboard', {}, { useClient: true });
  }

  getPlans() {
    return this.request('/v1/plans');
  }

  getFinanceiroResumo() {
    return this.request('/v1/financeiro/resumo', {}, { useClient: true });
  }

  getFinanceiroFaturas() {
    return this.request('/v1/financeiro/faturas', {}, { useClient: true });
  }

  getFinanceiroMensalidades() {
    return this.request('/v1/financeiro/mensalidades', {}, { useClient: true });
  }

  segundaViaFatura(invoiceId) {
    return this.request('/v1/financeiro/segunda-via', {
      method: 'POST',
      body: JSON.stringify({ invoice_id: invoiceId }),
    }, { useClient: true });
  }

  getVehicles() {
    return this.request('/v1/veiculos', {}, { useClient: true });
  }

  getVehicle(id) {
    return this.request(`/v1/veiculos/${id}`, {}, { useClient: true });
  }

  getVehicleLocation(id) {
    return this.request(`/v1/veiculos/${id}/localizacao`, {}, { useClient: true });
  }

  blockVehicle(id) {
    return this.request(`/v1/veiculos/${id}/bloqueio`, { method: 'POST' }, { useClient: true });
  }

  unblockVehicle(id) {
    return this.request(`/v1/veiculos/${id}/desbloqueio`, { method: 'POST' }, { useClient: true });
  }

  sendVehicleCommand(id, action) {
    return this.request(`/v1/veiculos/${id}/comandos/${action}`, { method: 'POST' }, { useClient: true });
  }

  getVehicleCommandHistory(id, { limit = 15 } = {}) {
    const qs = new URLSearchParams({ limit: String(limit) }).toString();
    return this.request(`/v1/veiculos/${id}/comandos/historico?${qs}`, {}, { useClient: true });
  }

  getAdminOperationsDashboard() {
    return this.request('/v1/admin/dashboard/operations', {}, { useAdmin: true });
  }

  getVehicleHistory(id, { from, to, hours } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (hours) params.set('hours', String(hours));
    const query = params.toString();
    return this.request(`/v1/veiculos/${id}/historico${query ? `?${query}` : ''}`, {}, { useClient: true });
  }

  shareVehicleLocation(id, durationMinutes = 60) {
    return this.request(`/v1/veiculos/${id}/compartilhar`, {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: durationMinutes }),
    }, { useClient: true });
  }

  getVehicleAnchor(id) {
    return this.request(`/v1/veiculos/${id}/ancora`, {}, { useClient: true });
  }

  activateVehicleAnchor(id, radiusMeters = 10) {
    return this.request(`/v1/veiculos/${id}/ancora`, {
      method: 'POST',
      body: JSON.stringify({ radius_meters: radiusMeters }),
    }, { useClient: true });
  }

  deactivateVehicleAnchor(id) {
    return this.request(`/v1/veiculos/${id}/ancora`, { method: 'DELETE' }, { useClient: true });
  }

  getReferralSummary() {
    return this.request('/v1/indicacoes/resumo', {}, { useClient: true });
  }

  validateReferralCode(code) {
    return this.request(`/v1/indicacoes/validar/${encodeURIComponent(code)}`);
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
    }, { useClient: true }).then((res) => {
      this.clearClientTokens({ keepRememberEmail: true });
      return res;
    });
  }

  registerFcmToken({ token, device_name, platform = 'web' }) {
    return this.request('/v1/notificacoes/token', {
      method: 'POST',
      body: JSON.stringify({ token, device_name, platform }),
    }, { useClient: true });
  }

  unregisterFcmToken(token) {
    return this.request('/v1/notificacoes/token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }, { useClient: true });
  }

  getFcmDevices() {
    return this.request('/v1/notificacoes/dispositivos', {}, { useClient: true });
  }

  testPushNotification() {
    return this.request('/v1/notificacoes/teste', { method: 'POST' }, { useClient: true });
  }

  requestPasswordReset(email, channel = 'both') {
    return this.request('/v1/auth/recuperar-senha/solicitar', {
      method: 'POST',
      body: JSON.stringify({ email, channel }),
    });
  }

  confirmPasswordReset({ email, code, new_password }) {
    return this.request('/v1/auth/recuperar-senha/confirmar', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    });
  }

  // ─── Admin ───────────────────────────────────────────────────────────────
  getIntegrations() {
    return this.request('/v1/admin/integracoes', {}, { useAdmin: true });
  }

  getIntegration(key) {
    return this.request(`/v1/admin/integracoes/${key}`, {}, { useAdmin: true });
  }

  saveIntegration(key, settings, enabled = true, credentialMode) {
    const body = { settings, enabled };
    if (credentialMode) body.credential_mode = credentialMode;
    return this.request(`/v1/admin/integracoes/${key}`, {
      method: 'PUT',
      body: JSON.stringify(body),
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

  getSmsProviders() {
    return this.request('/v1/admin/sms', {}, { useAdmin: true });
  }

  getSmsTypes() {
    return this.request('/v1/admin/sms/types', {}, { useAdmin: true });
  }

  getSmsDispatches(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/v1/admin/sms/dispatches${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  getSmsGpswoxGatewayInfo() {
    return this.request('/v1/sms/gateway/info', {}, { useAdmin: false, useClient: false });
  }

  getGpswoxSmsTemplates(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/v1/admin/sms/gpswox-templates${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  importGpswoxSmsTemplates(data) {
    return this.request('/v1/admin/sms/gpswox-templates/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  pushGpswoxSmsTemplates(data) {
    return this.request('/v1/admin/sms/gpswox-templates/push', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  createSmsProvider(data) {
    return this.request('/v1/admin/sms', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  setSmsPrimary(id) {
    return this.request(`/v1/admin/sms/${id}/primary`, { method: 'PUT' }, { useAdmin: true });
  }

  setSmsBackup(id) {
    return this.request(`/v1/admin/sms/${id}/backup`, { method: 'PUT' }, { useAdmin: true });
  }

  testSms(id) {
    return this.request(`/v1/admin/sms/${id}/test`, { method: 'POST' }, { useAdmin: true });
  }

  deleteSms(id) {
    return this.request(`/v1/admin/sms/${id}`, { method: 'DELETE' }, { useAdmin: true });
  }

  sendSmsManual(data) {
    return this.request('/v1/admin/sms/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  sendSmsCommand(data) {
    return this.request('/v1/admin/sms/send-command', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getTrackerModels() {
    return this.request('/v1/admin/sms/models', {}, { useAdmin: true });
  }

  createTrackerModel(data) {
    return this.request('/v1/admin/sms/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateTrackerModel(id, data) {
    return this.request(`/v1/admin/sms/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  createTrackerCommand(modelId, data) {
    return this.request(`/v1/admin/sms/models/${modelId}/commands`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateTrackerCommand(modelId, commandId, data) {
    return this.request(`/v1/admin/sms/models/${modelId}/commands/${commandId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  deleteTrackerCommand(modelId, commandId) {
    return this.request(`/v1/admin/sms/models/${modelId}/commands/${commandId}`, {
      method: 'DELETE',
    }, { useAdmin: true });
  }

  syncTrackerVehicles(data = {}) {
    return this.request('/v1/admin/veiculos/sync-tracker', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  /** @deprecated use syncTrackerVehicles */
  syncGpswoxVehicles(data = {}) {
    return this.syncTrackerVehicles(data);
  }

  getTrackerSyncStatus() {
    return this.request('/v1/admin/veiculos/sync-tracker/status', {}, { useAdmin: true });
  }

  /** @deprecated use getTrackerSyncStatus */
  getGpswoxSyncStatus() {
    return this.getTrackerSyncStatus();
  }

  getAdminVehicles(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    if (params.user_id) query.set('user_id', String(params.user_id));
    if (params.issue) query.set('issue', params.issue);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return this.request(`/v1/admin/veiculos${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  createAdminVehicle(data) {
    return this.request('/v1/admin/veiculos', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateAdminVehicle(id, data) {
    return this.request(`/v1/admin/veiculos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  assignVehicleInstaller(id, data) {
    return this.request(`/v1/admin/veiculos/${id}/instalador`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  unassignVehicleInstaller(id) {
    return this.request(`/v1/admin/veiculos/${id}/instalador`, {
      method: 'DELETE',
    }, { useAdmin: true });
  }

  getAdminUsers() {
    return this.request('/v1/admin/usuarios', {}, { useAdmin: true });
  }

  getAdminClientsSummary() {
    return this.request('/v1/admin/usuarios/painel/resumo', {}, { useAdmin: true });
  }

  getAdminClientsPanel(params = {}) {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.q) query.set('q', params.q);
    if (params.active) query.set('active', params.active);
    if (params.provisioning_status) query.set('provisioning_status', params.provisioning_status);
    if (params.never_accessed) query.set('never_accessed', params.never_accessed);
    if (params.access_inactive_days) query.set('access_inactive_days', params.access_inactive_days);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return this.request(`/v1/admin/usuarios/painel${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  getAdminClientDetail(userId) {
    return this.request(`/v1/admin/usuarios/${userId}`, {}, { useAdmin: true });
  }

  updateAdminClient(userId, data) {
    return this.request(`/v1/admin/usuarios/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getAdminCharges() {
    return this.request('/v1/admin/financeiro/cobrancas', {}, { useAdmin: true });
  }

  getAdminBillingNotifications(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/v1/admin/financeiro/notificacoes${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  getBillingAutomationStatus() {
    return this.request('/v1/admin/financeiro/cobranca/status', {}, { useAdmin: true });
  }

  markManualPayment(invoiceId, data) {
    return this.request(`/v1/admin/financeiro/cobrancas/${invoiceId}/baixa-manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  createAdminCharge(data) {
    return this.request('/v1/admin/financeiro/cobrancas', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  reprovisionUser(userId) {
    return this.request(`/v1/admin/financeiro/reprovisionar/${userId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, { useAdmin: true });
  }

  getAsaasSyncStatus() {
    return this.request('/v1/admin/financeiro/sync-asaas/status', {}, { useAdmin: true });
  }

  previewAsaasSync(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/v1/admin/financeiro/sync-asaas/preview${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  runAsaasSync(data = {}) {
    return this.request('/v1/admin/financeiro/sync-asaas', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getAdminPlans() {
    return this.request('/v1/admin/plans', {}, { useAdmin: true });
  }

  createAdminPlan(data) {
    return this.request('/v1/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateAdminPlan(id, data) {
    return this.request(`/v1/admin/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getPublicLanding() {
    return this.request('/v1/site/landing');
  }

  getAdminLanding() {
    return this.request('/v1/admin/site/landing', {}, { useAdmin: true });
  }

  updateAdminLanding(content) {
    return this.request('/v1/admin/site/landing', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }, { useAdmin: true });
  }

  getPaymentGateways() {
    return this.request('/v1/admin/financeiro/gateways', {}, { useAdmin: true });
  }

  getAlerts() {
    return this.request('/v1/alertas', {}, { useClient: true });
  }

  getAlertTypes() {
    return this.request('/v1/alertas/tipos', {}, { useClient: true });
  }

  getAlertPreferences() {
    return this.request('/v1/alertas/preferencias', {}, { useClient: true });
  }

  updateAlertPreferences(data) {
    return this.request('/v1/alertas/preferencias', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useClient: true });
  }

  markAlertRead(id) {
    return this.request(`/v1/alertas/${id}/lido`, { method: 'POST' }, { useClient: true });
  }

  markAllAlertsRead() {
    return this.request('/v1/alertas/marcar-todos-lidos', { method: 'POST' }, { useClient: true });
  }

  getAdminAlerts() {
    return this.request('/v1/admin/alertas', {}, { useAdmin: true });
  }

  getAdminAlertConfig() {
    return this.request('/v1/admin/alertas/config', {}, { useAdmin: true });
  }

  sendTestAlert(userId) {
    return this.request(`/v1/admin/alertas/teste/${userId}`, { method: 'POST' }, { useAdmin: true });
  }

  sendPromotion({ message, user_ids, all_clients }) {
    return this.request('/v1/admin/comunicacao/promocao', {
      method: 'POST',
      body: JSON.stringify({ message, user_ids, all_clients }),
    }, { useAdmin: true });
  }

  getFirebasePublicConfig() {
    return this.request('/v1/config/firebase');
  }

  // ─── Instalador ──────────────────────────────────────────────────────────
  getInstallerDashboard() {
    return this.request('/v1/instalador/painel', {}, { useClient: true });
  }

  getInstallerPending() {
    return this.request('/v1/instalador/agendamentos', {}, { useClient: true });
  }

  getInstallerHistory() {
    return this.request('/v1/instalador/historico', {}, { useClient: true });
  }

  getInstallerJob(id) {
    return this.request(`/v1/instalador/instalacoes/${id}`, {}, { useClient: true });
  }

  getInstallerTrackerModels() {
    return this.request('/v1/instalador/modelos-rastreador', {}, { useClient: true });
  }

  finalizeInstallation(id, formData) {
    const token = this.accessToken || localStorage.getItem('access_token');
    return fetch(`${BASE}/v1/instalador/instalacoes/${id}/finalizar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`);
      return data;
    });
  }

  getAdminInstallers() {
    return this.request('/v1/admin/instaladores', {}, { useAdmin: true });
  }

  createAdminInstaller(data) {
    return this.request('/v1/admin/instaladores', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getContratos() {
    return this.request('/v1/contratos', {}, { useClient: true });
  }

  getContractStatus() {
    return this.request('/v1/contratos/status', {}, { useClient: true });
  }

  async getClientAppPath() {
    const role = this.getStoredUser().role;
    if (role === 'installer') return '/instalador';
    try {
      const res = await this.getContractStatus();
      const accepted = Boolean(res.data?.service_accepted);
      this.setServiceContractAccepted(accepted);
      return accepted ? '/app' : '/app/contratos';
    } catch {
      return '/app/contratos';
    }
  }

  acceptServiceContract() {
    return this.request('/v1/contratos/servico/aceitar', { method: 'POST' }, { useClient: true });
  }

  acceptInstallationDelivery(installationLogId) {
    return this.request('/v1/contratos/entrega/aceitar', {
      method: 'POST',
      body: JSON.stringify({ installation_log_id: installationLogId }),
    }, { useClient: true });
  }

  async downloadContractDocument(tipo = 'servico', installationLogId) {
    const params = new URLSearchParams({ tipo });
    if (installationLogId) params.set('installation_log_id', String(installationLogId));
    const token = this.accessToken || localStorage.getItem('access_token');
    const response = await fetch(`${BASE}/v1/contratos/documento?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    const blob = await response.blob();
    const filename = tipo === 'entrega'
      ? `termo-entrega-${installationLogId}.html`
      : 'contrato-prestacao-servicos.html';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  getAdminContractTemplates() {
    return this.request('/v1/admin/contratos/templates', {}, { useAdmin: true });
  }

  updateAdminContractTemplate(slug, data) {
    return this.request(`/v1/admin/contratos/templates/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getAdminContractAcceptances() {
    return this.request('/v1/admin/contratos/aceites', {}, { useAdmin: true });
  }

  _adminFetchHeaders(extra = {}) {
    const token = this.adminToken
      || localStorage.getItem('admin_access_token')
      || localStorage.getItem('admin_token');
    const csrfToken = this.getAdminCsrfToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...extra,
    };
  }

  async downloadAdminContractDocument(acceptanceId) {
    const response = await fetch(`${BASE}/v1/admin/contratos/aceites/${acceptanceId}/documento`, {
      credentials: 'include',
      headers: this._adminFetchHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contrato-aceite-${acceptanceId}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async getContractPhotoBlob(photoId) {
    const token = this.accessToken || localStorage.getItem('access_token');
    const response = await fetch(`${BASE}/v1/contratos/fotos/${photoId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    return response.blob();
  }

  // ─── Frota (documentos + manutenção) ─────────────────────────────────────
  getFrotaOverview() {
    return this.request('/v1/frota', {}, { useClient: true });
  }

  createFrotaDocument(vehicleId, formData) {
    return this.uploadClientForm(`/v1/frota/documentos/veiculos/${vehicleId}`, formData);
  }

  updateFrotaDocument(id, formData) {
    return this.uploadClientForm(`/v1/frota/documentos/${id}`, formData, 'PUT');
  }

  deleteFrotaDocument(id) {
    return this.request(`/v1/frota/documentos/${id}`, { method: 'DELETE' }, { useClient: true });
  }

  async openFrotaDocumentFile(id) {
    const token = this.accessToken || localStorage.getItem('access_token');
    const response = await fetch(`${BASE}/v1/frota/documentos/${id}/arquivo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      this._throwClientError(response, data, { useClient: true });
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  createFrotaMaintenance(vehicleId, data) {
    return this.request(`/v1/frota/manutencao/veiculos/${vehicleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useClient: true });
  }

  updateFrotaMaintenance(id, data) {
    return this.request(`/v1/frota/manutencao/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useClient: true });
  }

  deleteFrotaMaintenance(id) {
    return this.request(`/v1/frota/manutencao/${id}`, { method: 'DELETE' }, { useClient: true });
  }

  async uploadClientForm(path, formData, method = 'POST') {
    const token = this.accessToken || localStorage.getItem('access_token');
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      this._throwClientError(response, data, { useClient: true });
    }
    return data;
  }

  getAdminFrotaDocuments() {
    return this.request('/v1/admin/frota/documentos', {}, { useAdmin: true });
  }

  createAdminFrotaDocument(vehicleId, formData) {
    return this.uploadAdminForm(`/v1/admin/frota/documentos/veiculos/${vehicleId}`, formData);
  }

  updateAdminFrotaDocument(id, formData) {
    return this.uploadAdminForm(`/v1/admin/frota/documentos/${id}`, formData, 'PUT');
  }

  deleteAdminFrotaDocument(id) {
    return this.request(`/v1/admin/frota/documentos/${id}`, { method: 'DELETE' }, { useAdmin: true });
  }

  async openAdminFrotaDocumentFile(id) {
    const response = await fetch(`${BASE}/v1/admin/frota/documentos/${id}/arquivo`, {
      credentials: 'include',
      headers: this._adminFetchHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  getAdminFrotaMaintenance() {
    return this.request('/v1/admin/frota/manutencao', {}, { useAdmin: true });
  }

  createAdminFrotaMaintenance(data) {
    return this.request('/v1/admin/frota/manutencao', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  updateAdminFrotaMaintenance(id, data) {
    return this.request(`/v1/admin/frota/manutencao/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  deleteAdminFrotaMaintenance(id) {
    return this.request(`/v1/admin/frota/manutencao/${id}`, { method: 'DELETE' }, { useAdmin: true });
  }

  getAdminFrotaLembretes(params = {}) {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.user_id != null) query.set('user_id', String(params.user_id));
    const qs = query.toString();
    return this.request(`/v1/admin/frota/lembretes${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  executarAdminFrotaLembretes() {
    return this.request('/v1/admin/frota/lembretes/executar', { method: 'POST' }, { useAdmin: true });
  }

  async downloadAdminExport(resource, format, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== '') query.set(key, String(value));
    });
    query.set('format', format);

    const response = await fetch(`${BASE}/v1/admin/export/${resource}?${query}`, {
      credentials: 'include',
      headers: this._adminFetchHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `${resource}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async uploadAdminForm(path, formData, method = 'POST') {
    const response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: this._adminFetchHeaders(),
      body: formData,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    return data;
  }

  getAdminIndicacoes() {
    return this.request('/v1/admin/indicacoes', {}, { useAdmin: true });
  }

  syncAdminIndicacoes() {
    return this.request('/v1/admin/indicacoes/sync', { method: 'POST' }, { useAdmin: true });
  }

  getEmergencyContacts() {
    return this.request('/v1/emergencia/contatos', {}, { useClient: true });
  }

  saveEmergencyContacts(contatos) {
    return this.request('/v1/emergencia/contatos', {
      method: 'PUT',
      body: JSON.stringify({ contatos }),
    }, { useClient: true });
  }

  triggerEmergency(payload) {
    return this.request('/v1/emergencia/acionar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useClient: true });
  }

  getAdminEmergencyEvents(limit = 30) {
    return this.request(`/v1/admin/emergencia/eventos?limit=${limit}`, {}, { useAdmin: true });
  }

  getAdminEmergencySummary() {
    return this.request('/v1/admin/emergencia/resumo', {}, { useAdmin: true });
  }

  getAdminAuditLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.action) query.set('action', params.action);
    if (params.actor_type) query.set('actor_type', params.actor_type);
    if (params.resource_type) query.set('resource_type', params.resource_type);
    if (params.actor_id) query.set('actor_id', params.actor_id);
    if (params.resource_id) query.set('resource_id', params.resource_id);
    if (params.search) query.set('search', params.search);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const qs = query.toString();
    return this.request(`/v1/admin/audit${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  getAdminAuditActions() {
    return this.request('/v1/admin/audit/acoes', {}, { useAdmin: true });
  }

  getAdminAuditResourceTypes() {
    return this.request('/v1/admin/audit/recursos', {}, { useAdmin: true });
  }

  // ─── Platform (painel master) ───────────────────────────────────────────
  getStoredAdminUser() {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || 'null');
    } catch {
      return null;
    }
  }

  getPlatformHealth() {
    return this.request('/v1/platform/health', {}, { useAdmin: true });
  }

  getPlatformTenants(limit = 50) {
    return this.request(`/v1/platform/tenants?limit=${limit}`, {}, { useAdmin: true });
  }

  getPlatformTenant(id) {
    return this.request(`/v1/platform/tenants/${id}`, {}, { useAdmin: true });
  }

  createPlatformTenant(payload) {
    return this.request('/v1/platform/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  updatePlatformTenant(id, payload) {
    return this.request(`/v1/platform/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  suspendPlatformTenant(id) {
    return this.request(`/v1/platform/tenants/${id}/suspend`, { method: 'POST' }, { useAdmin: true });
  }

  getPlatformModules() {
    return this.request('/v1/platform/modules', {}, { useAdmin: true });
  }

  activatePlatformTenantModule(tenantId, code) {
    return this.request(`/v1/platform/tenants/${tenantId}/modules/${code}/activate`, {
      method: 'POST',
      body: JSON.stringify({ source: 'MANUAL' }),
    }, { useAdmin: true });
  }

  suspendPlatformTenantModule(tenantId, code) {
    return this.request(`/v1/platform/tenants/${tenantId}/modules/${code}/suspend`, {
      method: 'POST',
    }, { useAdmin: true });
  }

  getPlatformSaasPlans(status = 'ACTIVE') {
    return this.request(`/v1/platform/saas-plans?status=${status}`, {}, { useAdmin: true });
  }

  getPlatformSaasPlan(id) {
    return this.request(`/v1/platform/saas-plans/${id}`, {}, { useAdmin: true });
  }

  createPlatformSaasPlan(payload) {
    return this.request('/v1/platform/saas-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  updatePlatformSaasPlan(id, payload) {
    return this.request(`/v1/platform/saas-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  setPlatformSaasPlanModules(id, moduleCodes) {
    return this.request(`/v1/platform/saas-plans/${id}/modules`, {
      method: 'PUT',
      body: JSON.stringify({ module_codes: moduleCodes }),
    }, { useAdmin: true });
  }

  getPlatformTenantSubscription(tenantId) {
    return this.request(`/v1/platform/tenants/${tenantId}/subscription`, {}, { useAdmin: true });
  }

  assignPlatformTenantSubscription(tenantId, payload) {
    return this.request(`/v1/platform/tenants/${tenantId}/subscription`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  getPlatformTenantUsage(tenantId) {
    return this.request(`/v1/platform/tenants/${tenantId}/usage`, {}, { useAdmin: true });
  }

  refreshPlatformTenantUsage(tenantId) {
    return this.request(`/v1/platform/tenants/${tenantId}/usage/refresh`, {
      method: 'POST',
    }, { useAdmin: true });
  }

  getPlatformTenantIntegrations(tenantId) {
    return this.request(`/v1/platform/tenants/${tenantId}/integrations`, {}, { useAdmin: true });
  }

  setPlatformTenantIntegrationMode(tenantId, key, credentialMode) {
    return this.request(`/v1/platform/tenants/${tenantId}/integrations/${key}/mode`, {
      method: 'PATCH',
      body: JSON.stringify({ credential_mode: credentialMode }),
    }, { useAdmin: true });
  }

  getPlatformOnboardingSchema() {
    return this.request('/v1/platform/onboarding/schema', {}, { useAdmin: true });
  }

  getPlatformOnboardingPlans() {
    return this.request('/v1/platform/onboarding/plans', {}, { useAdmin: true });
  }

  createPlatformTenantOnboarding(payload) {
    return this.request('/v1/platform/onboarding/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  getTenantBranding(slug) {
    const qs = slug ? `?slug=${encodeURIComponent(slug)}` : '';
    return this.request(`/v1/tenant/branding${qs}`);
  }

  getAdminModules() {
    return this.request('/v1/admin/modules', {}, { useAdmin: true });
  }

  getAdminBranding() {
    return this.request('/v1/admin/branding', {}, { useAdmin: true });
  }

  updateAdminBranding(payload) {
    return this.request('/v1/admin/branding', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  getAdminCrmLeads(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/v1/admin/crm/leads${qs ? `?${qs}` : ''}`, {}, { useAdmin: true });
  }

  createAdminCrmLead(payload) {
    return this.request('/v1/admin/crm/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  updateAdminCrmLead(id, payload) {
    return this.request(`/v1/admin/crm/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, { useAdmin: true });
  }

  submitTenantLead(payload) {
    return this.request('/v1/tenant/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();

export function isContractRequiredError(err) {
  return err?.code === 'CONTRACT_REQUIRED' || err?.contractRequired === true;
}
