const { getAnchorRepository } = require('../repositories/anchor-repository');
const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const gpswox = require('../integrations/gpswox-gateway');
const { getAlertService } = require('./alert-service');
const { getVehicleService } = require('./vehicle-service');
const {
  haversineMeters,
  isIgnitionOn,
  extractLocationFromPayload,
} = require('../lib/geo');
const logger = require('../logger');

const DEFAULT_RADIUS_METERS = 10;

function formatAnchor(row) {
  if (!row) return null;
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    latitude: row.latitude,
    longitude: row.longitude,
    radius_meters: row.radius_meters,
    status: row.status,
    active: row.active,
    triggered_at: row.triggered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class AnchorService {
  constructor() {
    this.anchors = getAnchorRepository();
    this.vehicles = getVehicleRepository();
  }

  async getForUser(userId, vehicleId) {
    const vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    const anchor = await this.anchors.findActiveByVehicle(vehicleId);
    return {
      ancora: formatAnchor(anchor),
      radius_meters: DEFAULT_RADIUS_METERS,
    };
  }

  async activate(userId, vehicleId, { radius_meters = DEFAULT_RADIUS_METERS } = {}) {
    const vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    if (!vehicle.gpswox_device_id) {
      throw new Error('Veículo sem device_id GPSWOX configurado.');
    }
    if (vehicle.status === VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Veículo aguardando instalação do rastreador.');
    }

    const location = await gpswox.getLocation({
      device_id: vehicle.gpswox_device_id,
      veiculo: vehicle.gpswox_name || vehicle.plate,
    });

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Não foi possível obter a localização atual do veículo.');
    }

    const anchor = await this.anchors.create({
      vehicle_id: vehicle.id,
      user_id: userId,
      latitude: lat,
      longitude: lng,
      radius_meters,
    });

    return {
      ancora: formatAnchor(anchor),
      message: `Âncora ativada. O veículo será bloqueado se ligar e sair mais de ${radius_meters}m deste ponto.`,
    };
  }

  async deactivate(userId, vehicleId) {
    const vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    const anchor = await this.anchors.deactivate(vehicleId, userId);
    if (!anchor) throw new Error('Nenhuma âncora ativa para este veículo.');

    return {
      ancora: formatAnchor(anchor),
      message: 'Âncora desativada.',
    };
  }

  async evaluateFromWebhook(payload = {}) {
    const location = extractLocationFromPayload(payload);
    const deviceId = String(
      payload.device_id || payload.deviceId || payload.imei || payload.id || ''
    ).trim();

    if (!deviceId) return { evaluated: false, reason: 'device_id ausente.' };
    return this.evaluateForDevice(deviceId, location);
  }

  async evaluateAllActive() {
    const anchors = await this.anchors.listMonitoring();
    const results = [];

    for (const anchor of anchors) {
      try {
        const location = await gpswox.getLocation({
          device_id: anchor.gpswox_device_id,
          veiculo: anchor.gpswox_name || anchor.plate,
        });
        const result = await this._evaluateAnchor(anchor, {
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
          ignicao: location.ignicao,
        });
        results.push(result);
      } catch (err) {
        logger.warn('Falha ao avaliar âncora.', {
          anchorId: anchor.id,
          vehicleId: anchor.vehicle_id,
          err: err.message,
        });
        results.push({ anchor_id: anchor.id, evaluated: false, error: err.message });
      }
    }

    return { evaluated: results.length, results };
  }

  async evaluateForDevice(deviceId, location = {}) {
    const anchor = await this.anchors.findActiveByDeviceId(deviceId);
    if (!anchor) return { evaluated: false, reason: 'Sem âncora ativa.' };
    return this._evaluateAnchor(anchor, location);
  }

  async _evaluateAnchor(anchor, location) {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { evaluated: false, anchor_id: anchor.id, reason: 'Coordenadas indisponíveis.' };
    }

    if (!isIgnitionOn(location.ignicao)) {
      return {
        evaluated: true,
        anchor_id: anchor.id,
        triggered: false,
        reason: 'Ignição desligada.',
        distance_meters: haversineMeters(anchor.latitude, anchor.longitude, lat, lng),
      };
    }

    const distance = haversineMeters(anchor.latitude, anchor.longitude, lat, lng);
    if (distance <= anchor.radius_meters) {
      return {
        evaluated: true,
        anchor_id: anchor.id,
        triggered: false,
        distance_meters: Math.round(distance),
      };
    }

    return this._triggerAnchor(anchor, { lat, lng, distance });
  }

  async _triggerAnchor(anchor, { lat, lng, distance }) {
    const vehicle = await this.vehicles.findById(anchor.vehicle_id);
    if (!vehicle) {
      return { evaluated: false, anchor_id: anchor.id, reason: 'Veículo não encontrado.' };
    }

    const plate = vehicle.plate || 'veículo';
    const message = `${plate} saiu ${Math.round(distance)}m da âncora com ignição ligada. Bloqueio automático enviado.`;

    try {
      await getAlertService().raiseVehicleAlert({
        userId: anchor.user_id,
        vehicleId: anchor.vehicle_id,
        alertType: 'ancora',
        title: 'Âncora — saída detectada',
        message,
        source: 'ancora',
        sourceEventId: `ancora-${anchor.id}-${Date.now()}`,
        deviceId: vehicle.gpswox_device_id,
        payload: {
          anchor_id: anchor.id,
          distance_meters: Math.round(distance),
          latitude: lat,
          longitude: lng,
        },
      });
    } catch (err) {
      logger.warn('Falha ao notificar âncora.', { anchorId: anchor.id, err: err.message });
    }

    try {
      await getVehicleService().block(anchor.user_id, anchor.vehicle_id);
    } catch (err) {
      logger.error('Falha ao bloquear veículo por âncora.', {
        anchorId: anchor.id,
        vehicleId: anchor.vehicle_id,
        err: err.message,
      });
      return {
        evaluated: true,
        anchor_id: anchor.id,
        triggered: false,
        error: err.message,
        distance_meters: Math.round(distance),
      };
    }

    await this.anchors.markTriggered(anchor.id);

    return {
      evaluated: true,
      anchor_id: anchor.id,
      triggered: true,
      blocked: true,
      distance_meters: Math.round(distance),
    };
  }
}

let instance = null;

function getAnchorService() {
  if (!instance) instance = new AnchorService();
  return instance;
}

function startAnchorPoller(intervalMs = 30000) {
  const run = async () => {
    try {
      await getAnchorService().evaluateAllActive();
    } catch (err) {
      logger.warn('Poller de âncora falhou.', { err: err.message });
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = { AnchorService, getAnchorService, startAnchorPoller, formatAnchor };
