class SmsProvider {
  constructor(config) {
    this.config = config;
  }

  async testConnection() {
    throw new Error('testConnection não implementado.');
  }

  async sendMessage({ phone, message }) {
    throw new Error('sendMessage não implementado.');
  }
}

module.exports = SmsProvider;
