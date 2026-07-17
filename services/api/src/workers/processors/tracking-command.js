const crypto = require('crypto');
const { getPool } = require('../../db/pool');
const gpswox = require('../../integrations/gpswox-gateway');
const { COMMAND_STATES, canTransition } = require('../../infrastructure/command-states');
const { emitVehicleCommandUpdated } = require('../../infrastructure/websocket');
const { normalizeProviderName } = require('../../lib/tracking-platform');
const logger = require('../../logger');

async function updateCommandState(commandUuid, fromState, toState, extra = {}) {
  if (!canTransition(fromState, toState)) {
    throw new Error(`Transição inválida ${fromState} -> ${toState}`);
  }

  const pool = getPool();
  await pool.query(
    `UPDATE vehicle_command_logs
     SET status = $2,
         state = $2,
         command_uuid = COALESCE(command_uuid, $3),
         provider_response = COALESCE($4::jsonb, provider_response),
         updated_at = NOW(),
         sent_at = CASE WHEN $2 = 'SENT' THEN NOW() ELSE sent_at END,
         acknowledged_at = CASE WHEN $2 = 'ACKNOWLEDGED' THEN NOW() ELSE acknowledged_at END,
         confirmed_at = CASE WHEN $2 = 'CONFIRMED' THEN NOW() ELSE confirmed_at END,
         failed_at = CASE WHEN $2 IN ('FAILED','EXPIRED') THEN NOW() ELSE failed_at END
     WHERE id = $1 AND (state IS NULL OR state = $5 OR status = $5)`,
    [
      extra.logId,
      toState,
      commandUuid,
      extra.providerResponse ? JSON.stringify(extra.providerResponse) : null,
      fromState,
    ],
  );

  emitVehicleCommandUpdated({
    commandUuid,
    logId: extra.logId,
    vehicleId: extra.vehicleId,
    command: extra.command,
    state: toState,
    status: toState,
  });
}

async function sendProviderCommand(vehicle, command, provider) {
  const normalized = String(command).toLowerCase();
  if (normalized === 'bloquear') {
    return gpswox.blockDevice(vehicle.tracker_device_id, provider);
  }
  if (normalized === 'desbloquear') {
    return gpswox.unblockDevice(vehicle.tracker_device_id, provider);
  }
  return gpswox.sendCommand(vehicle.tracker_device_id, command, provider);
}

async function processTrackingCommand(job) {
  const { logId, vehicleDbId, command, provider, idempotencyKey } = job.data;
  const commandUuid = job.data.commandUuid || crypto.randomUUID();
  const pool = getPool();

  const existing = await pool.query(
    `SELECT l.id, l.state, l.status, l.command_uuid, v.tracker_device_id, v.tracking_provider
     FROM vehicle_command_logs l
     JOIN vehicles v ON v.id = l.vehicle_id
     WHERE l.id = $1 LIMIT 1`,
    [logId],
  );
  const row = existing.rows[0];
  if (!row) {
    logger.warn('Log de comando não encontrado.', { logId });
    return { skipped: true };
  }

  const current = row.state || row.status?.toUpperCase() || COMMAND_STATES[0];
  const mappedCurrent = COMMAND_STATES.includes(current) ? current : 'REQUESTED';

  if (['SENT', 'ACKNOWLEDGED', 'CONFIRMED'].includes(mappedCurrent)) {
    return { idempotent: true, commandUuid: row.command_uuid };
  }

  if (idempotencyKey) {
    const dup = await pool.query(
      `SELECT id FROM vehicle_command_logs
       WHERE idempotency_key = $1 AND id <> $2
         AND state IN ('SENT','ACKNOWLEDGED','CONFIRMED') LIMIT 1`,
      [idempotencyKey, logId],
    );
    if (dup.rows[0]) {
      await updateCommandState(commandUuid, mappedCurrent, 'FAILED', {
        logId,
        vehicleId: vehicleDbId,
        command,
        providerResponse: { error: 'duplicate_idempotency_key' },
      });
      return { duplicate: true };
    }
  }

  const trackingProvider = normalizeProviderName(provider || row.tracking_provider || 'gpswox');
  const vehicle = { tracker_device_id: row.tracker_device_id };

  await updateCommandState(commandUuid, mappedCurrent, 'QUEUED', { logId, vehicleId: vehicleDbId, command });
  await updateCommandState(commandUuid, 'QUEUED', 'SENDING', { logId, vehicleId: vehicleDbId, command });

  try {
    const result = await sendProviderCommand(vehicle, command, trackingProvider);
    await updateCommandState(commandUuid, 'SENDING', 'SENT', {
      logId, vehicleId: vehicleDbId, command, providerResponse: result,
    });
    await updateCommandState(commandUuid, 'SENT', 'ACKNOWLEDGED', {
      logId, vehicleId: vehicleDbId, command, providerResponse: result,
    });
    await updateCommandState(commandUuid, 'ACKNOWLEDGED', 'CONFIRMED', {
      logId, vehicleId: vehicleDbId, command, providerResponse: result,
    });
    return { ok: true, commandUuid };
  } catch (err) {
    await updateCommandState(commandUuid, 'SENDING', 'FAILED', {
      logId, vehicleId: vehicleDbId, command, providerResponse: { error: err.message },
    });
    throw err;
  }
}

module.exports = { processTrackingCommand };
