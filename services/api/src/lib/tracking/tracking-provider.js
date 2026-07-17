const SYNC_STRATEGIES = {
  PROVIDER_MASTER: 'PROVIDER_MASTER',
  READ_ONLY: 'READ_ONLY',
};

const WRITABLE_METHODS = new Set([
  'blockDevice',
  'unblockDevice',
  'sendCommand',
  'createUser',
  'createDevice',
  'createSharing',
]);

class TrackingProvider {
  constructor({ name, syncStrategy = SYNC_STRATEGIES.PROVIDER_MASTER, tenantId = null } = {}) {
    this.name = name;
    this.syncStrategy = syncStrategy;
    this.tenantId = tenantId;
  }

  getProviderName() {
    return this.name;
  }

  isReadOnly() {
    return this.syncStrategy === SYNC_STRATEGIES.READ_ONLY;
  }

  assertWritable(method) {
    if (this.isReadOnly() && WRITABLE_METHODS.has(method)) {
      const err = new Error(
        `Operação "${method}" bloqueada: provedor ${this.name} em modo somente leitura (READ_ONLY).`,
      );
      err.code = 'TRACKING_READ_ONLY';
      err.statusCode = 403;
      throw err;
    }
  }

  async getLocation() {
    throw new Error('getLocation não implementado.');
  }

  async blockDevice() {
    throw new Error('blockDevice não implementado.');
  }

  async unblockDevice() {
    throw new Error('unblockDevice não implementado.');
  }

  async sendCommand() {
    throw new Error('sendCommand não implementado.');
  }

  async getHistory() {
    throw new Error('getHistory não implementado.');
  }

  async createSharing() {
    throw new Error('createSharing não implementado.');
  }

  async createUser() {
    throw new Error('createUser não implementado.');
  }

  async createDevice() {
    throw new Error('createDevice não implementado.');
  }

  async listDevices() {
    throw new Error('listDevices não implementado.');
  }
}

module.exports = { TrackingProvider, SYNC_STRATEGIES, WRITABLE_METHODS };
