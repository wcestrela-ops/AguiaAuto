const SmsProvider = require('../contracts/SmsProvider');

class AndroidProvider extends SmsProvider {
  async testConnection() {
    const baseUrl = (this.config.base_url || '').replace(/\/$/, '');
    if (!baseUrl || !this.config.api_key) {
      return { ok: false, message: 'Configure URL e chave do agente Android.', status: 'error' };
    }

    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${this.config.api_key}` },
      });
      if (!response.ok) {
        return { ok: false, message: `Agente respondeu ${response.status}.`, status: 'error' };
      }
      return { ok: true, message: 'Agente Android conectado.', status: 'connected' };
    } catch (err) {
      return { ok: false, message: err.message, status: 'error' };
    }
  }

  async sendMessage({ phone, message }) {
    const baseUrl = (this.config.base_url || '').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.api_key}`,
      },
      body: JSON.stringify({
        device_id: this.config.device_id,
        phone,
        message,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { status: 'FAILED', error: data?.error || data?.message || `Erro ${response.status}` };
    }

    return {
      status: data?.status || 'SENT',
      externalId: data?.external_id || data?.id || null,
    };
  }
}

module.exports = AndroidProvider;
