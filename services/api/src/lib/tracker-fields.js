/** Campos de rastreamento — nomes canônicos tracker_* (Fase 2). */

function coalesceField(body, ...keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      return body[key];
    }
  }
  return undefined;
}

function normalizeVehicleInput(body = {}) {
  return {
    tracking_provider: coalesceField(body, 'tracking_provider', 'provider') || body.tracking_provider,
    tracker_device_id: coalesceField(body, 'tracker_device_id', 'gpswox_device_id'),
    tracker_name: coalesceField(body, 'tracker_name', 'gpswox_name'),
    tracker_synced_at: coalesceField(body, 'tracker_synced_at', 'gpswox_synced_at'),
    plate: body.plate,
    brand: body.brand,
    model: body.model,
    color: body.color,
    year: body.year,
    status: body.status,
    user_id: body.user_id,
    tracker_phone: body.tracker_phone,
    tracker_model: body.tracker_model,
    tracker_model_id: body.tracker_model_id,
    tracker_imei: body.tracker_imei,
    assigned_installer_id: body.assigned_installer_id,
    installation_scheduled_at: body.installation_scheduled_at,
    assigned_at: body.assigned_at,
  };
}

function normalizeInstallerFinalizeInput(body = {}) {
  const createFlag = body.create_in_tracker ?? body.create_in_gpswox;
  return {
    tracking_provider: coalesceField(body, 'tracking_provider', 'provider') || 'gpswox',
    tracker_device_id: coalesceField(body, 'tracker_device_id', 'gpswox_device_id'),
    tracker_name: coalesceField(body, 'tracker_name', 'gpswox_name'),
    plate: body.plate,
    imei: body.imei,
    tracker_phone: body.tracker_phone,
    tracker_model_id: body.tracker_model_id,
    notes: body.notes,
    report: body.report,
    duration_minutes: body.duration_minutes,
    create_in_tracker: createFlag === true || createFlag === 'true',
  };
}

function normalizeUserProvisioningInput(data = {}) {
  return {
    ...data,
    tracker_user_id: data.tracker_user_id ?? data.gpswox_user_id,
  };
}

function formatVehicleFields(row = {}) {
  const trackerDeviceId = row.tracker_device_id ?? null;
  const trackerName = row.tracker_name ?? null;
  const trackerSyncedAt = row.tracker_synced_at ?? null;

  return {
    tracking_provider: row.tracking_provider || null,
    tracking_provider_label: row.tracking_provider === 'traccar' ? 'Traccar' : row.tracking_provider === 'gpswox' ? 'GPSWOX' : null,
    tracker_device_id: trackerDeviceId,
    tracker_name: trackerName,
    tracker_synced_at: trackerSyncedAt,
    /** @deprecated use tracker_device_id */
    gpswox_device_id: trackerDeviceId,
    /** @deprecated use tracker_name */
    gpswox_name: trackerName,
    /** @deprecated use tracker_synced_at */
    gpswox_synced_at: trackerSyncedAt,
  };
}

function formatUserTrackerFields(row = {}) {
  const trackerUserId = row.tracker_user_id ?? null;
  return {
    tracker_user_id: trackerUserId,
    /** @deprecated use tracker_user_id */
    gpswox_user_id: trackerUserId,
  };
}

function pickDeviceId(row = {}) {
  return row.tracker_device_id ?? row.tracker_name ?? null;
}

module.exports = {
  normalizeVehicleInput,
  normalizeInstallerFinalizeInput,
  normalizeUserProvisioningInput,
  formatVehicleFields,
  formatUserTrackerFields,
  pickDeviceId,
};
