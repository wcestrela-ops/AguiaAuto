const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { sanitizeForLog } = require('./sanitize-log');
const { touchVehicleViewer, removeVehicleViewer } = require('./presence');
const { getVehicleRepository } = require('../repositories/vehicle-repository');

let wss = null;
const clients = new Map();

async function userOwnsVehicle(userId, vehicleId) {
  const vehicle = await getVehicleRepository().findByIdForUser(vehicleId, userId);
  return Boolean(vehicle);
}

function parseToken(req) {
  const url = new URL(req.url, 'http://localhost');
  const fromQuery = url.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const token = parseToken(req);
    if (!token) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      ws.close(4401, 'Invalid token');
      return;
    }

    const clientId = `${payload.sub || payload.id || 'anon'}-${Date.now()}`;
    clients.set(ws, { clientId, userId: payload.sub || payload.id, vehicles: new Set() });
    ws.send(JSON.stringify({ event: 'connected', data: { clientId } }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.event === 'vehicle.subscribe' && msg.data?.vehicleId) {
          const meta = clients.get(ws);
          const vehicleId = String(msg.data.vehicleId);
          const allowed = await userOwnsVehicle(meta.userId, vehicleId);
          if (!allowed) {
            ws.send(JSON.stringify({ event: 'error', data: { code: 'ACCESS_DENIED', message: 'Veículo não autorizado.' } }));
            return;
          }
          if (meta) {
            meta.vehicles.add(vehicleId);
            touchVehicleViewer(vehicleId, meta.clientId);
          }
          ws.send(JSON.stringify({ event: 'vehicle.subscribed', data: { vehicleId } }));
        }
        if (msg.event === 'vehicle.unsubscribe' && msg.data?.vehicleId) {
          const meta = clients.get(ws);
          if (meta) {
            meta.vehicles.delete(String(msg.data.vehicleId));
            removeVehicleViewer(String(msg.data.vehicleId), meta.clientId);
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ event: 'error', data: { message: err.message } }));
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      if (meta) {
        for (const vid of meta.vehicles) {
          removeVehicleViewer(vid, meta.clientId);
        }
      }
      clients.delete(ws);
    });
  });

  return wss;
}

function broadcast(event, data, filterFn) {
  if (!wss) return 0;
  const payload = JSON.stringify(sanitizeForLog({ event, data, timestamp: new Date().toISOString() }));
  let sent = 0;
  for (const [ws, meta] of clients) {
    if (ws.readyState !== 1) continue;
    if (filterFn && !filterFn(meta, data)) continue;
    ws.send(payload);
    sent += 1;
  }
  return sent;
}

function emitVehiclePositionUpdated(vehicleId, position) {
  return broadcast('vehicle.position.updated', { vehicleId, ...position }, (meta, data) =>
    meta.vehicles.has(String(data.vehicleId)) || meta.vehicles.size === 0
  );
}

function emitVehicleStatusUpdated(vehicleId, status) {
  return broadcast('vehicle.status.updated', { vehicleId, ...status }, (meta, data) =>
    meta.vehicles.has(String(data.vehicleId))
  );
}

function emitVehicleCommandUpdated(payload) {
  return broadcast('vehicle.command.updated', payload);
}

function emitVehicleAlertCreated(alert) {
  return broadcast('vehicle.alert.created', alert);
}

function emitBillingPaymentUpdated(payment) {
  return broadcast('billing.payment.updated', payment);
}

function getWsStats() {
  return {
    connectedClients: clients.size,
    path: '/ws',
  };
}

module.exports = {
  attachWebSocket,
  broadcast,
  emitVehiclePositionUpdated,
  emitVehicleStatusUpdated,
  emitVehicleCommandUpdated,
  emitVehicleAlertCreated,
  emitBillingPaymentUpdated,
  getWsStats,
};
