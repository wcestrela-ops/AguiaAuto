const WhatsAppProvider = require('../contracts/WhatsAppProvider');

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

class MetaCloudProvider extends WhatsAppProvider {
  constructor(config) {
    super(config);
    this.accessToken = config.access_token;
    this.phoneNumberId = config.phone_number_id;
    this.businessAccountId = config.business_account_id;
  }

  _headers() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  _messagesUrl() {
    return `${GRAPH_URL}/${this.phoneNumberId}/messages`;
  }

  async sendText({ to, text }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'text',
        text: { body: text },
      }),
    });
  }

  async sendImage({ to, url, caption }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'image',
        image: { link: url, caption },
      }),
    });
  }

  async sendDocument({ to, url, filename, caption }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'document',
        document: { link: url, filename, caption },
      }),
    });
  }

  async sendAudio({ to, url }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'audio',
        audio: { link: url },
      }),
    });
  }

  async sendVideo({ to, url, caption }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'video',
        video: { link: url, caption },
      }),
    });
  }

  async sendLocation({ to, latitude, longitude, name, address }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'location',
        location: { latitude, longitude, name, address },
      }),
    });
  }

  async sendContact({ to, contacts }) {
    const contact = Array.isArray(contacts) ? contacts[0] : contacts;
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'contacts',
        contacts: [contact],
      }),
    });
  }

  async sendButtons({ to, body, buttons }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map((btn, i) => ({
              type: 'reply',
              reply: { id: btn.id || `btn_${i}`, title: btn.title || btn.text },
            })),
          },
        },
      }),
    });
  }

  async sendList({ to, body, button, sections }) {
    return this._request(this._messagesUrl(), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this._normalizePhone(to),
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: { button, sections },
        },
      }),
    });
  }

  async getStatus() {
    const data = await this._request(
      `${GRAPH_URL}/${this.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: this._headers() }
    );
    return {
      connected: Boolean(data?.verified_name || data?.display_phone_number),
      raw: data,
    };
  }

  async connect() {
    return { message: 'Meta Cloud API não requer conexão manual — use webhook configurado.' };
  }

  async disconnect() {
    return { message: 'Meta Cloud API não possui desconexão de sessão.' };
  }

  async generateQrCode() {
    return { qrcode: null, message: 'Meta Cloud API não utiliza QR Code.' };
  }

  async testConnection() {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('Access Token e Phone Number ID são obrigatórios.');
    }

    const data = await this._request(
      `${GRAPH_URL}/${this.phoneNumberId}?fields=verified_name,display_phone_number`,
      { headers: this._headers() }
    );

    return {
      success: true,
      message: `Meta Cloud API OK — ${data.display_phone_number || data.verified_name || 'número verificado'}.`,
      status: 'connected',
    };
  }
}

module.exports = MetaCloudProvider;
