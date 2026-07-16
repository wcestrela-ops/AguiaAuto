const SmsProvider = require('../contracts/SmsProvider');
const { applyGatewayTemplate, normalizePhoneDigits } = require('../lib/gateway-template');

class HttpGatewayProvider extends SmsProvider {
  getTemplate() {
    return this.config.url_template || this.config.base_url || '';
  }

  getMethod() {
    return String(this.config.http_method || 'GET').toUpperCase();
  }

  async testConnection() {
    const template = this.getTemplate();
    if (!template) {
      return { ok: false, message: 'Configure a URL template do gateway.', status: 'error' };
    }

    if (!template.includes('%NUMBER%') && !template.includes('%number%')) {
      return {
        ok: false,
        message: 'URL deve conter %NUMBER% (padrão GPSWOX).',
        status: 'error',
      };
    }

    if (!template.includes('%MESSAGE%') && !template.includes('%message%')) {
      return {
        ok: false,
        message: 'URL deve conter %MESSAGE% (padrão GPSWOX).',
        status: 'error',
      };
    }

    try {
      const testUrl = applyGatewayTemplate(template, {
        phone: '5511999999999',
        message: 'TEST',
        username: this.config.sender_id || undefined,
        password: this.config.api_key || undefined,
      });

      const method = this.getMethod();
      const response = await fetch(testUrl, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      });

      const body = await response.text().catch(() => '');

      if (!response.ok) {
        return {
          ok: false,
          message: `Gateway respondeu HTTP ${response.status}: ${body.slice(0, 120)}`,
          status: 'error',
        };
      }

      return {
        ok: true,
        message: 'Gateway HTTP (GPSWOX) respondeu OK.',
        status: 'connected',
        preview_url: testUrl.replace(/5511999999999/, '***').replace(/TEST/, '***'),
      };
    } catch (err) {
      return { ok: false, message: err.message, status: 'error' };
    }
  }

  async sendMessage({ phone, message }) {
    const digits = normalizePhoneDigits(phone);
    if (!digits || !message) {
      return { status: 'FAILED', error: 'Telefone e mensagem são obrigatórios.' };
    }

    const url = applyGatewayTemplate(this.getTemplate(), {
      phone: digits,
      message,
      username: this.config.sender_id || undefined,
      password: this.config.api_key || undefined,
    });

    const method = this.getMethod();
    const response = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    });

    const body = await response.text().catch(() => '');

    if (!response.ok) {
      return {
        status: 'FAILED',
        error: body.slice(0, 200) || `Erro HTTP ${response.status}`,
      };
    }

    return {
      status: 'SENT',
      externalId: body.slice(0, 100) || `http-${response.status}`,
    };
  }
}

module.exports = HttpGatewayProvider;
