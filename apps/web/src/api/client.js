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
    localStorage.removeItem('service_contract_accepted');
  }

  setServiceContractAccepted(accepted) {
    localStorage.setItem('service_contract_accepted', accepted ? '1' : '0');
  }

  isServiceContractAccepted() {
    return localStorage.getItem('service_contract_accepted') === '1';
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
      const err = new Error(data?.message || data?.error || `Erro ${response.status}`);
      err.code = data?.error;
      throw err;
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

  syncGpswoxVehicles(data = {}) {
    return this.request('/v1/admin/veiculos/sync-gpswox', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { useAdmin: true });
  }

  getGpswoxSyncStatus() {
    return this.request('/v1/admin/veiculos/sync-gpswox/status', {}, { useAdmin: true });
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

  async downloadAdminContractDocument(acceptanceId) {
    const token = this.adminToken || localStorage.getItem('admin_token');
    const response = await fetch(`${BASE}/v1/admin/contratos/aceites/${acceptanceId}/documento`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
}

export const api = new ApiClient();
