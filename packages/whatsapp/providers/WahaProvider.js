const WhatsAppProvider = require('../contracts/WhatsAppProvider');

class WahaProvider extends WhatsAppProvider {
  constructor(config) {
    super(config);
    this.baseUrl = (config.base_url || '').replace(/\/$/, '');
    this.apiKey = config.api_key;
    this.session = config.session || 'default';
  }

  _headers() {
    return { 'X-Api-Key': this.apiKey };
  }

  _chatId(to) {
    const phone = this._normalizePhone(to);
    return phone.includes('@') ? phone : `${phone}@c.us`;
  }

  async sendText({ to, text }) {
    return this._request(`${this.baseUrl}/api/sendText`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        text,
      }),
    });
  }

  async sendImage({ to, url, caption }) {
    return this._request(`${this.baseUrl}/api/sendImage`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        file: { url },
        caption,
      }),
    });
  }

  async sendDocument({ to, url, filename, caption }) {
    return this._request(`${this.baseUrl}/api/sendFile`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        file: { url, filename },
        caption,
      }),
    });
  }

  async sendAudio({ to, url }) {
    return this._request(`${this.baseUrl}/api/sendVoice`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        file: { url },
      }),
    });
  }

  async sendVideo({ to, url, caption }) {
    return this._request(`${this.baseUrl}/api/sendVideo`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        file: { url },
        caption,
      }),
    });
  }

  async sendLocation({ to, latitude, longitude, title }) {
    return this._request(`${this.baseUrl}/api/sendLocation`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        latitude,
        longitude,
        title,
      }),
    });
  }

  async sendContact({ to, contacts }) {
    return this._request(`${this.baseUrl}/api/sendContactVcard`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        contacts,
      }),
    });
  }

  async sendButtons({ to, title, buttons }) {
    return this._request(`${this.baseUrl}/api/sendButtons`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        title,
        buttons,
      }),
    });
  }

  async sendList({ to, title, button, sections }) {
    return this._request(`${this.baseUrl}/api/sendList`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        session: this.session,
        chatId: this._chatId(to),
        title,
        button,
        sections,
      }),
    });
  }

  async getStatus() {
    const data = await this._request(`${this.baseUrl}/api/sessions/${this.session}`, {
      headers: this._headers(),
    });
    const status = data?.status || data?.engine?.status;
    return {
      connected: status === 'WORKING' || status === 'connected',
      raw: data,
    };
  }

  async connect() {
    return this._request(`${this.baseUrl}/api/sessions/${this.session}/start`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ name: this.session }),
    });
  }

  async disconnect() {
    return this._request(`${this.baseUrl}/api/sessions/${this.session}/stop`, {
      method: 'POST',
      headers: this._headers(),
    });
  }

  async generateQrCode() {
    const data = await this._request(`${this.baseUrl}/api/${this.session}/auth/qr`, {
      headers: this._headers(),
    });
    return {
      qrcode: data?.value || data?.qr || data?.base64 || null,
      raw: data,
    };
  }

  async testConnection() {
    if (!this.baseUrl || !this.apiKey || !this.session) {
      throw new Error('URL Base, API Key e Sessão são obrigatórios.');
    }

    await this._request(`${this.baseUrl}/api/sessions`, {
      headers: this._headers(),
    });

    const status = await this.getStatus();
    return {
      success: true,
      message: status.connected ? 'WAHA conectada.' : 'WAHA autenticada, sessão desconectada.',
      status: status.connected ? 'connected' : 'disconnected',
    };
  }
}

module.exports = WahaProvider;
