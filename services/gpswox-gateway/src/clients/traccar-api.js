const logger = require('../logger');

/** Comandos GPSWOX → tipos Traccar (protocolo dependente; GT06 etc.). */
const COMMAND_MAP = {
  engine_stop: 'engineStop',
  engine_resume: 'engineResume',
  engineStop: 'engineStop',
  engineResume: 'engineResume',
};

function knotsToKmh(knots) {
  const value = Number(knots);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1.852 * 10) / 10;
}

function formatSpeed(knots) {
  const kmh = knotsToKmh(knots);
  return `${kmh} km/h`;
}

class TraccarApiClient {
  constructor(settings = {}) {
    this.baseUrl = (settings.url || '').replace(/\/$/, '');
    this.email = settings.email || '';
    this.password = settings.password || '';
    this.apiToken = settings.api_token || '';
    this.defaultGroupId = settings.default_group_id ?? null;
    this.enabled = Boolean(
      this.baseUrl && (this.apiToken || (this.email && this.password)),
    );
  }

  getAuthHeaders() {
    if (this.apiToken) {
      return { Authorization: `Bearer ${this.apiToken}` };
    }
    const encoded = Buffer.from(`${this.email}:${this.password}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  async request(path, options = {}) {
    if (!this.enabled) {
      throw new Error('Traccar: configure url e credenciais (e-mail/senha ou token) no painel admin.');
    }

    const cleanPath = String(path || '').replace(/^\//, '');
    const url = new URL(`${this.baseUrl}/api/${cleanPath}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value == null) continue;
        if (Array.isArray(value)) {
          value.forEach((item) => url.searchParams.append(key, String(item)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...(options.headers || {}),
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : await response.text();

    if (!response.ok) {
      logger.error('Erro na API Traccar.', { path: cleanPath, status: response.status, data });
      const message = typeof data === 'object' && data?.message
        ? data.message
        : typeof data === 'string' && data
          ? data
          : `Erro Traccar (${response.status})`;
      throw new Error(message);
    }

    return data;
  }

  mapCommandType(command) {
    const key = String(command || '').trim();
    return COMMAND_MAP[key] || key;
  }

  normalizeLocation(device, position) {
    const lat = parseFloat(position?.latitude ?? device?.latitude);
    const lng = parseFloat(position?.longitude ?? device?.longitude);

    return {
      success: true,
      device_id: device?.id ?? position?.deviceId,
      veiculo: device?.name || `Dispositivo ${device?.id}`,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      endereco: position?.address || 'Endereço não disponível',
      velocidade: position?.speed != null ? formatSpeed(position.speed) : '0 km/h',
      ignicao: position?.attributes?.ignition ?? position?.attributes?.io1 ?? null,
      maps_link: Number.isFinite(lat) && Number.isFinite(lng)
        ? `https://maps.google.com/?q=${lat},${lng}`
        : null,
      fonte: 'traccar_api',
      capturado_em: position?.fixTime || position?.deviceTime || new Date().toISOString(),
      online: device?.status === 'online',
    };
  }

  async getDevice(deviceId) {
    const devices = await this.request('devices', { query: { id: deviceId } });
    const list = Array.isArray(devices) ? devices : [];
    const device = list.find((d) => String(d.id) === String(deviceId)) || list[0];
    if (!device) {
      throw new Error(`Dispositivo ${deviceId} não encontrado no Traccar.`);
    }
    return device;
  }

  async getLatestPosition(deviceId) {
    const positions = await this.request('positions', { query: { deviceId } });
    const list = Array.isArray(positions) ? positions : [];
    if (list.length === 0) return null;
    return list[list.length - 1];
  }

  async getDeviceLocation(deviceId) {
    const device = await this.getDevice(deviceId);
    const position = await this.getLatestPosition(deviceId);
    if (!position) {
      throw new Error(`Sem posição recente para o dispositivo ${deviceId}.`);
    }
    return this.normalizeLocation(device, position);
  }

  async sendCommand(deviceId, command, { textChannel = false } = {}) {
    const type = this.mapCommandType(command);
    return this.request('commands/send', {
      method: 'POST',
      body: {
        deviceId: Number(deviceId),
        type,
        textChannel: Boolean(textChannel),
      },
    });
  }

  async blockDevice(deviceId) {
    return this.sendCommand(deviceId, 'engineStop');
  }

  async unblockDevice(deviceId) {
    return this.sendCommand(deviceId, 'engineResume');
  }

  async createUser(payload) {
    const body = {
      name: payload.name || payload.email,
      email: payload.email,
      password: payload.password,
      phone: payload.phone || null,
    };

    const user = await this.request('users', { method: 'POST', body });
    const groupId = payload.group_id ?? this.defaultGroupId;
    if (user?.id && groupId != null && groupId !== '') {
      await this.request('permissions', {
        method: 'POST',
        body: {
          userId: user.id,
          groupId: Number(groupId),
        },
      });
    }
    return user;
  }

  async createDevice(payload) {
    const body = {
      name: payload.name || payload.plate || payload.title || 'Veículo',
      uniqueId: String(payload.imei || payload.unique_id || payload.uniqueId || payload.device_id || ''),
      phone: payload.phone || payload.sim_number || payload.tracker_phone || null,
      model: payload.model || payload.tracker_model || null,
      contact: payload.contact || null,
    };

    if (!body.uniqueId) {
      throw new Error('Traccar: uniqueId (IMEI) é obrigatório para criar device.');
    }

    const groupId = payload.group_id ?? this.defaultGroupId;
    if (groupId != null && groupId !== '') {
      body.groupId = Number(groupId);
    }

    return this.request('devices', { method: 'POST', body });
  }

  async getHistory(deviceId, from, to) {
    const positions = await this.request('positions', {
      query: { deviceId, from, to },
    });

    const items = Array.isArray(positions) ? positions : [];
    const points = items.map((point) => ({
      latitude: parseFloat(point.latitude),
      longitude: parseFloat(point.longitude),
      time: point.fixTime || point.deviceTime || point.serverTime || null,
      speed: point.speed != null ? knotsToKmh(point.speed) : null,
      address: point.address || null,
    })).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

    return {
      device_id: deviceId,
      from,
      to,
      total: points.length,
      points,
      raw: positions,
    };
  }

  async createSharing(deviceId, { durationMinutes = 60 } = {}) {
    const expiration = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const form = new URLSearchParams();
    form.set('deviceId', String(deviceId));
    form.set('expiration', expiration);

    const url = `${this.baseUrl}/api/share/device`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const shareToken = await response.text();
    if (!response.ok) {
      throw new Error(shareToken || `Erro ao compartilhar (${response.status})`);
    }

    const trimmed = (shareToken || '').trim();
    const shareUrl = trimmed.startsWith('http')
      ? trimmed
      : `${this.baseUrl}/?token=${encodeURIComponent(trimmed)}`;

    return {
      url: shareUrl,
      duration_minutes: durationMinutes,
      expires_at: expiration,
      token: trimmed,
    };
  }

  async getDevices() {
    const devices = await this.request('devices', { query: { all: true } });
    const list = Array.isArray(devices) ? devices : [];

    return {
      items: list.map((device) => ({
        id: device.id,
        name: device.name,
        title: device.name,
        user_id: device.attributes?.aguia_user_id || device.attributes?.userId || null,
        phone: device.phone,
        sim_number: device.phone,
        imei: device.uniqueId,
        uniqueId: device.uniqueId,
        model: device.model,
        status: device.status,
        disabled: device.disabled,
        lastUpdate: device.lastUpdate,
      })),
      total: list.length,
    };
  }

  async testConnection() {
    const health = await fetch(`${this.baseUrl}/api/health`, {
      headers: this.getAuthHeaders(),
    });
    if (!health.ok) {
      throw new Error(`Health check falhou (${health.status}).`);
    }
    const devices = await this.request('devices', { query: { limit: 1 } });
    const count = Array.isArray(devices) ? devices.length : 0;
    return { ok: true, devices_sample: count };
  }
}

module.exports = {
  TraccarApiClient,
  COMMAND_MAP,
  knotsToKmh,
  formatSpeed,
};
