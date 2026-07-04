const { createProvider } = require('./provider-factory');
const { getRepository } = require('./repository');

const SEND_METHODS = [
  'sendText', 'sendImage', 'sendDocument', 'sendAudio', 'sendVideo',
  'sendLocation', 'sendContact', 'sendButtons', 'sendList',
];

class WhatsAppService {
  constructor({ repository, logger } = {}) {
    this.repository = repository || getRepository();
    this.logger = logger || console;
  }

  async _getProviderChain() {
    const chain = await this.repository.getFailoverChain();
    if (chain.length === 0) {
      throw new Error('Nenhum provedor WhatsApp configurado. Configure no painel admin.');
    }
    return chain;
  }

  async _executeWithFailover(method, payload, { userRef, recipient } = {}) {
    const chain = await this._getProviderChain();
    const errors = [];

    for (let i = 0; i < chain.length; i++) {
      const config = chain[i];
      const usedFailover = i > 0;
      const start = Date.now();

      try {
        const provider = createProvider(config);
        const result = await provider[method](payload);
        const responseTime = Date.now() - start;

        await this.repository.updateStatus(config.id, 'connected');
        await this.repository.log({
          provider_id: config.id,
          provider_type: config.provider,
          action: method,
          recipient,
          user_ref: userRef,
          success: true,
          response_time: responseTime,
          used_failover: usedFailover,
        });

        this.logger.info?.('WhatsApp enviado.', {
          method, provider: config.provider, provider_id: config.id,
          recipient, responseTime, usedFailover,
        });

        return {
          success: true,
          provider: config.provider,
          provider_id: config.id,
          used_failover: usedFailover,
          response_time: responseTime,
          data: result,
        };
      } catch (err) {
        const responseTime = Date.now() - start;
        errors.push({ provider: config.provider, error: err.message });

        await this.repository.updateStatus(config.id, 'error');
        await this.repository.log({
          provider_id: config.id,
          provider_type: config.provider,
          action: method,
          recipient,
          user_ref: userRef,
          success: false,
          response_time: responseTime,
          error_message: err.message,
          used_failover: usedFailover,
        });

        this.logger.warn?.('Falha no provedor WhatsApp.', {
          method, provider: config.provider, error: err.message, usedFailover,
        });
      }
    }

    throw new Error(`Todos os provedores falharam: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`);
  }

  async sendText(payload, meta) {
    return this._executeWithFailover('sendText', payload, {
      recipient: payload.to,
      userRef: meta?.user,
    });
  }

  async sendImage(payload, meta) {
    return this._executeWithFailover('sendImage', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendDocument(payload, meta) {
    return this._executeWithFailover('sendDocument', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendAudio(payload, meta) {
    return this._executeWithFailover('sendAudio', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendVideo(payload, meta) {
    return this._executeWithFailover('sendVideo', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendLocation(payload, meta) {
    return this._executeWithFailover('sendLocation', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendContact(payload, meta) {
    return this._executeWithFailover('sendContact', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendButtons(payload, meta) {
    return this._executeWithFailover('sendButtons', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async sendList(payload, meta) {
    return this._executeWithFailover('sendList', payload, { recipient: payload.to, userRef: meta?.user });
  }

  async executeOnProvider(providerId, method, payload) {
    const config = await this.repository.findById(providerId);
    if (!config) throw new Error('Provedor não encontrado.');

    const provider = createProvider(config);
    if (typeof provider[method] !== 'function') {
      throw new Error(`Método "${method}" não suportado.`);
    }

    return provider[method](payload);
  }

  async testConnection(providerId) {
    const config = await this.repository.findById(providerId);
    if (!config) throw new Error('Provedor não encontrado.');

    const provider = createProvider(config);
    const result = await provider.testConnection();
    await this.repository.updateStatus(providerId, result.status || 'connected');
    return result;
  }

  async getStatus(providerId) {
    return this.executeOnProvider(providerId, 'getStatus');
  }

  async connect(providerId) {
    const result = await this.executeOnProvider(providerId, 'connect');
    await this.repository.updateStatus(providerId, 'connecting');
    return result;
  }

  async disconnect(providerId) {
    const result = await this.executeOnProvider(providerId, 'disconnect');
    await this.repository.updateStatus(providerId, 'disconnected');
    return result;
  }

  async generateQrCode(providerId) {
    return this.executeOnProvider(providerId, 'generateQrCode');
  }
}

let serviceInstance = null;

function getWhatsAppService(options) {
  if (!serviceInstance) {
    serviceInstance = new WhatsAppService(options);
  }
  return serviceInstance;
}

module.exports = { WhatsAppService, getWhatsAppService, SEND_METHODS };
