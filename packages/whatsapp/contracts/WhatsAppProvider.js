class WhatsAppProvider {
  constructor(config) {
    if (new.target === WhatsAppProvider) {
      throw new Error('WhatsAppProvider é abstrato — implemente um provider concreto.');
    }
    this.config = config;
    this.name = config.provider;
  }

  async sendText() { throw new Error(`${this.name}: sendText não implementado.`); }
  async sendImage() { throw new Error(`${this.name}: sendImage não implementado.`); }
  async sendDocument() { throw new Error(`${this.name}: sendDocument não implementado.`); }
  async sendAudio() { throw new Error(`${this.name}: sendAudio não implementado.`); }
  async sendVideo() { throw new Error(`${this.name}: sendVideo não implementado.`); }
  async sendLocation() { throw new Error(`${this.name}: sendLocation não implementado.`); }
  async sendContact() { throw new Error(`${this.name}: sendContact não implementado.`); }
  async sendButtons() { throw new Error(`${this.name}: sendButtons não implementado.`); }
  async sendList() { throw new Error(`${this.name}: sendList não implementado.`); }
  async getStatus() { throw new Error(`${this.name}: getStatus não implementado.`); }
  async connect() { throw new Error(`${this.name}: connect não implementado.`); }
  async disconnect() { throw new Error(`${this.name}: disconnect não implementado.`); }
  async generateQrCode() { throw new Error(`${this.name}: generateQrCode não implementado.`); }
  async testConnection() { throw new Error(`${this.name}: testConnection não implementado.`); }

  _normalizePhone(number) {
    return String(number).replace(/\D/g, '');
  }

  async _request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message || data?.error?.message || data?.error || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = WhatsAppProvider;
