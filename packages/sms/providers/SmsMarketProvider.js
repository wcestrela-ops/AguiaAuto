const SmsProvider = require('../contracts/SmsProvider');

class SmsMarketProvider extends SmsProvider {
  async testConnection() {
    return { ok: false, message: 'SMSMarket ainda não implementado.', status: 'unknown' };
  }

  async sendMessage() {
    return { status: 'FAILED', error: 'Provedor SMSMarket ainda não implementado.' };
  }
}

module.exports = SmsMarketProvider;
