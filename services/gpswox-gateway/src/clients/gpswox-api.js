const logger = require('../logger');

class GpswoxApiClient {
  constructor(settings) {
    this.baseUrl = (settings.url || '').replace(/\/$/, '');
    this.apiHash = settings.api_hash || '';
    this.enabled = Boolean(this.baseUrl && this.apiHash);
  }

  async request(path, options = {}) {
    if (!this.enabled) {
      throw new Error('GPSWOX: configure url e api_hash no painel admin.');
    }

    const url = new URL(`${this.baseUrl}/api/${path}`);
    url.searchParams.set('user_api_hash', this.apiHash);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value != null) url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      logger.error('Erro na API GPSWOX.', { path, status: response.status, data });
      throw new Error(data?.message || data?.error || `Erro GPSWOX (${response.status})`);
    }

    return data;
  }

  async getDevices() {
    return this.request('get_devices');
  }

  async getDeviceLocation(deviceId) {
    const data = await this.getDevices();
    const items = data?.items || data?.devices || data || [];
    const list = Array.isArray(items) ? items : Object.values(items);
    const device = list.find(d => String(d.id) === String(deviceId));

    if (!device) {
      throw new Error(`Dispositivo ${deviceId} não encontrado.`);
    }

    const lat = parseFloat(device.lat ?? device.latitude);
    const lng = parseFloat(device.lng ?? device.longitude);

    return {
      success:      true,
      device_id:    device.id,
      veiculo:      device.name || device.title,
      latitude:     Number.isFinite(lat) ? lat : null,
      longitude:    Number.isFinite(lng) ? lng : null,
      endereco:     device.address || device.last_address || 'Endereço não disponível',
      velocidade:   device.speed ? `${device.speed} km/h` : '0 km/h',
      ignicao:      device.engine_status ?? device.ignition ?? null,
      maps_link:    Number.isFinite(lat) && Number.isFinite(lng)
        ? `https://maps.google.com/?q=${lat},${lng}`
        : null,
      fonte:        'api_oficial',
      capturado_em: new Date().toISOString(),
    };
  }

  async sendCommand(deviceId, command) {
    return this.request('send_command', {
      method: 'POST',
      body: { device_id: deviceId, type: command },
    });
  }

  async blockDevice(deviceId) {
    return this.sendCommand(deviceId, 'engine_stop');
  }

  async unblockDevice(deviceId) {
    return this.sendCommand(deviceId, 'engine_resume');
  }

  async createUser(payload) {
    return this.request('add_user', { method: 'POST', body: payload });
  }

  async createDevice(payload) {
    return this.request('add_device', { method: 'POST', body: payload });
  }

  async getHistory(deviceId, from, to) {
    return this.request('get_history', {
      query: { device_id: deviceId, from, to },
    });
  }

  async createSharing({ deviceId, durationMinutes = 60, deleteAfterExpiration = true }) {
    return this.request('sharing', {
      method: 'POST',
      body: {
        devices: [Number(deviceId)],
        expiration_by: 'duration',
        expiration_duration: durationMinutes,
        delete_after_expiration: deleteAfterExpiration,
      },
    });
  }
}

module.exports = { GpswoxApiClient };
