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

  requestPasswordReset(email) {
    return this.request('/v1/auth/recuperar-senha/solicitar', {
      method: 'POST',
      body: JSON.stringify({ email }),
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

  getAdminVehicles() {
    return this.request('/v1/admin/veiculos', {}, { useAdmin: true });
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

  getAdminUsers() {
    return this.request('/v1/admin/usuarios', {}, { useAdmin: true });
  }

  getAdminCharges() {
    return this.request('/v1/admin/financeiro/cobrancas', {}, { useAdmin: true });
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

  getAdminPlans() {
    return this.request('/v1/admin/plans', {}, { useAdmin: true });
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

  acceptServiceContract() {
    return this.request('/v1/contratos/servico/aceitar', { method: 'POST' }, { useClient: true });
  }

  acceptInstallationDelivery(installationLogId) {
    return this.request('/v1/contratos/entrega/aceitar', {
      method: 'POST',
      body: JSON.stringify({ installation_log_id: installationLogId }),
    }, { useClient: true });
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
}

export const api = new ApiClient();
