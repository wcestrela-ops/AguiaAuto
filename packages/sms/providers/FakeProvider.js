const SmsProvider = require('../contracts/SmsProvider');

class FakeProvider extends SmsProvider {
  async testConnection() {
    return { ok: true, message: 'Gateway SMS simulado disponível.', status: 'connected' };
  }

  async sendMessage({ phone, message }) {
    if (!phone || !message) {
      return { status: 'FAILED', error: 'Telefone e mensagem são obrigatórios.' };
    }
    return {
      status: 'SENT',
      externalId: `fake-${Date.now()}`,
    };
  }
}

module.exports = FakeProvider;
