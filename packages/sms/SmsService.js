const { createProvider } = require('./provider-factory');
const { getRepository } = require('./repository');

const REUSABLE_STATUSES = ['sent', 'accepted', 'processing', 'queued'];
const RETRYABLE_STATUSES = ['failed'];

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || null;
}

class SmsService {
  constructor({ repository, logger } = {}) {
    this.repository = repository || getRepository();
    this.logger = logger || console;
  }

  async _getProviderChain() {
    const chain = await this.repository.getFailoverChain();
    if (chain.length === 0) {
      throw new Error('Nenhum gateway SMS configurado. Configure em Integrações → SMS.');
    }
    return chain;
  }

  _toTrackerResponse(dispatch, phone, message, duplicate = false) {
    return {
      dispatch_id: dispatch.id,
      status: dispatch.status,
      provider: dispatch.provider_type,
      provider_id: dispatch.provider_id,
      external_id: dispatch.external_id,
      phone,
      message,
      duplicate,
      queued: ['queued', 'processing'].includes(dispatch.status),
    };
  }

  async sendTrackerCommand({
    phone,
    message,
    action,
    vehicle_id,
    user_id,
    source = 'aguia-failover',
    idempotencyKey,
  }) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new Error('Número do chip inválido.');
    }
    if (!message) {
      throw new Error('Mensagem SMS obrigatória.');
    }

    if (idempotencyKey) {
      const existing = await this.repository.findDispatchByIdempotency(idempotencyKey);
      if (existing) {
        const reusable = REUSABLE_STATUSES.includes(existing.status);
        const retryable = RETRYABLE_STATUSES.includes(existing.status);
        if (reusable) {
          return this._toTrackerResponse(existing, normalizedPhone, message, true);
        }
        if (!retryable) {
          return this._toTrackerResponse(existing, normalizedPhone, message, true);
        }
      }
    }

    let dispatch;
    try {
      dispatch = await this.repository.createDispatch({
        idempotency_key: idempotencyKey || null,
        phone: normalizedPhone,
        message,
        action: action || null,
        vehicle_id: vehicle_id ? Number(vehicle_id) : null,
        user_id: user_id ? Number(user_id) : null,
        source,
        status: 'processing',
      });
    } catch (error) {
      if (idempotencyKey && error.code === '23505') {
        const existing = await this.repository.findDispatchByIdempotency(idempotencyKey);
        if (existing) return this._toTrackerResponse(existing, normalizedPhone, message, true);
      }
      throw error;
    }

    try {
      const result = await this._executeWithFailover('sendMessage', { phone: normalizedPhone, message }, {
        vehicleId: vehicle_id,
        userRef: user_id,
        recipient: normalizedPhone,
        action: action || 'tracker.command',
      });

      const updated = await this.repository.updateDispatch(dispatch.id, {
        provider_id: result.provider_id,
        provider_type: result.provider,
        status: result.data?.status === 'FAILED' ? 'failed' : 'sent',
        external_id: result.data?.externalId || null,
        error_message: result.data?.error || null,
      });

      return this._toTrackerResponse(updated, normalizedPhone, message, false);
    } catch (error) {
      await this.repository.updateDispatch(dispatch.id, {
        status: 'failed',
        error_message: error.message,
      });
      throw error;
    }
  }

  async sendText({ to, text, user, vehicleId, action = 'notification' }) {
    const phone = normalizePhone(to);
    if (!phone || !text) {
      throw new Error('Destinatário e mensagem são obrigatórios.');
    }

    const result = await this._executeWithFailover('sendMessage', { phone, message: text }, {
      recipient: phone,
      userRef: user,
      vehicleId,
      action,
    });

    await this.repository.createDispatch({
      phone,
      message: text,
      action,
      vehicle_id: vehicleId || null,
      user_id: user ? Number(user) : null,
      provider_id: result.provider_id,
      provider_type: result.provider,
      status: result.data?.status === 'FAILED' ? 'failed' : 'sent',
      external_id: result.data?.externalId || null,
      source: 'notification',
    });

    return result;
  }

  async sendBillingReminder(to, { valor, vencimento, link, userId }) {
    const text = `💰 Lembrete de mensalidade Águia\nValor: R$ ${valor}\nVencimento: ${vencimento}${link ? `\nPague aqui: ${link}` : ''}`;
    return this.sendText({ to, text, user: userId, action: 'billing.reminder' });
  }

  async sendVehicleAlert(to, message, { userId, vehicleId } = {}) {
    return this.sendText({ to, text: message, user: userId, vehicleId, action: 'vehicle.alert' });
  }

  async _executeWithFailover(method, payload, { userRef, recipient, vehicleId, action } = {}) {
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

        if (result.status === 'FAILED') {
          throw new Error(result.error || 'Falha no gateway SMS.');
        }

        await this.repository.updateStatus(config.id, 'connected');
        await this.repository.log({
          provider_id: config.id,
          provider_type: config.provider,
          action: action || method,
          recipient,
          vehicle_id: vehicleId ? Number(vehicleId) : null,
          user_ref: userRef ? String(userRef) : null,
          success: true,
          response_time: responseTime,
          used_failover: usedFailover,
        });

        this.logger.info?.('SMS enviado.', {
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
          action: action || method,
          recipient,
          vehicle_id: vehicleId ? Number(vehicleId) : null,
          user_ref: userRef ? String(userRef) : null,
          success: false,
          response_time: responseTime,
          error_message: err.message,
          used_failover: usedFailover,
        });

        this.logger.warn?.('Falha no gateway SMS.', {
          method, provider: config.provider, error: err.message, usedFailover,
        });
      }
    }

    throw new Error(`Todos os gateways SMS falharam: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`);
  }

  async testConnection(providerId) {
    const config = await this.repository.findById(providerId);
    if (!config) throw new Error('Provedor não encontrado.');

    const provider = createProvider(config);
    const result = await provider.testConnection();
    await this.repository.updateStatus(providerId, result.status || (result.ok ? 'connected' : 'error'));
    return result;
  }

  async listDispatches(options) {
    return this.repository.listDispatches(options);
  }
}

let serviceInstance = null;

function getSmsService(options) {
  if (!serviceInstance) {
    serviceInstance = new SmsService(options);
  }
  return serviceInstance;
}

module.exports = { SmsService, getSmsService };
