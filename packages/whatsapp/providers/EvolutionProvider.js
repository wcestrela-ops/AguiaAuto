const WhatsAppProvider = require('../contracts/WhatsAppProvider');

class EvolutionProvider extends WhatsAppProvider {
  constructor(config) {
    super(config);
    this.baseUrl = (config.base_url || '').replace(/\/$/, '');
    this.apiKey = config.api_key;
    this.instance = config.instance;
  }

  _headers() {
    return { apikey: this.apiKey };
  }

  async sendText({ to, text }) {
    return this._request(`${this.baseUrl}/message/sendText/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        text,
      }),
    });
  }

  async sendImage({ to, url, caption }) {
    return this._request(`${this.baseUrl}/message/sendMedia/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        mediatype: 'image',
        media: url,
        caption,
      }),
    });
  }

  async sendDocument({ to, url, filename, caption }) {
    return this._request(`${this.baseUrl}/message/sendMedia/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        mediatype: 'document',
        media: url,
        fileName: filename,
        caption,
      }),
    });
  }

  async sendAudio({ to, url }) {
    return this._request(`${this.baseUrl}/message/sendMedia/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        mediatype: 'audio',
        media: url,
      }),
    });
  }

  async sendVideo({ to, url, caption }) {
    return this._request(`${this.baseUrl}/message/sendMedia/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        mediatype: 'video',
        media: url,
        caption,
      }),
    });
  }

  async sendLocation({ to, latitude, longitude, name, address }) {
    return this._request(`${this.baseUrl}/message/sendLocation/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        latitude,
        longitude,
        name,
        address,
      }),
    });
  }

  async sendContact({ to, contacts }) {
    return this._request(`${this.baseUrl}/message/sendContact/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        contact: contacts,
      }),
    });
  }

  async sendButtons({ to, title, description, footer, buttons }) {
    return this._request(`${this.baseUrl}/message/sendButtons/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        title,
        description,
        footer,
        buttons,
      }),
    });
  }

  async sendList({ to, title, description, buttonText, sections }) {
    return this._request(`${this.baseUrl}/message/sendList/${this.instance}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        number: this._normalizePhone(to),
        title,
        description,
        buttonText,
        sections,
      }),
    });
  }

  async getStatus() {
    const data = await this._request(`${this.baseUrl}/instance/connectionState/${this.instance}`, {
      headers: this._headers(),
    });
    return {
      connected: data?.instance?.state === 'open' || data?.state === 'open',
      raw: data,
    };
  }

  async connect() {
    return this._request(`${this.baseUrl}/instance/connect/${this.instance}`, {
      method: 'GET',
      headers: this._headers(),
    });
  }

  async disconnect() {
    return this._request(`${this.baseUrl}/instance/logout/${this.instance}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
  }

  async generateQrCode() {
    const data = await this.connect();
    return {
      qrcode: data?.base64 || data?.qrcode?.base64 || data?.code || null,
      raw: data,
    };
  }

  async testConnection() {
    if (!this.baseUrl || !this.apiKey || !this.instance) {
      throw new Error('URL Base, API Key e Instância são obrigatórios.');
    }

    await this._request(`${this.baseUrl}/instance/fetchInstances`, {
      headers: this._headers(),
    });

    const status = await this.getStatus();
    return {
      success: true,
      message: status.connected ? 'Evolution API conectada.' : 'Evolution API autenticada, instância desconectada.',
      status: status.connected ? 'connected' : 'disconnected',
    };
  }
}

module.exports = EvolutionProvider;
