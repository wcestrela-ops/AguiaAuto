const gateway = require('../../integrations/gpswox-gateway');
const { TrackingProvider } = require('./tracking-provider');
const { getProviderLabel } = require('../tracking-platform');

class GatewayTrackingProvider extends TrackingProvider {
  async getLocation(deviceId, options = {}) {
    return gateway.getLocation({
      deviceId,
      veiculo: options.veiculo,
      provider: this.name,
    });
  }

  async blockDevice(deviceId) {
    this.assertWritable('blockDevice');
    return gateway.blockDevice(deviceId, this.name);
  }

  async unblockDevice(deviceId) {
    this.assertWritable('unblockDevice');
    return gateway.unblockDevice(deviceId, this.name);
  }

  async sendCommand(deviceId, command) {
    this.assertWritable('sendCommand');
    return gateway.sendCommand(deviceId, command, this.name);
  }

  async getHistory(deviceId, from, to) {
    return gateway.getHistory(deviceId, from, to, this.name);
  }

  async createSharing(deviceId, durationMinutes = 60) {
    this.assertWritable('createSharing');
    return gateway.createSharing(deviceId, durationMinutes, this.name);
  }

  async createUser(payload) {
    this.assertWritable('createUser');
    return gateway.createCliente({ ...payload, provider: this.name });
  }

  async createDevice(payload) {
    this.assertWritable('createDevice');
    return gateway.createVeiculo({ ...payload, provider: this.name });
  }

  async listDevices() {
    return gateway.listDevices(this.name);
  }

  getLabel() {
    return getProviderLabel(this.name);
  }
}

module.exports = { GatewayTrackingProvider };
