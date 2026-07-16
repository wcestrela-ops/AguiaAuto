const { Router } = require('express');
const { getVehicleService } = require('../../../services/vehicle-service');
const { getUserRepository } = require('../../../repositories/user-repository');
const { getAuditService } = require('../../../services/audit-service');
const { VEHICLE_STATUS } = require('../../../repositories/vehicle-repository');

const router = Router();

const VALID_STATUSES = Object.values(VEHICLE_STATUS);

router.get('/', async (req, res) => {
  try {
    const data = await getVehicleService().listAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_id, plate, brand, model, color, year, gpswox_device_id, gpswox_name, status, tracker_phone, tracker_model, tracker_model_id, tracker_imei } = req.body;

    if (!user_id || !plate) {
      return res.status(400).json({ success: false, error: 'user_id e plate são obrigatórios.' });
    }

    const user = await getUserRepository().findById(user_id);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Usuário não encontrado.' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status inválido.' });
    }

    const data = await getVehicleService().create({
      user_id,
      plate,
      brand,
      model,
      color,
      year,
      gpswox_device_id,
      gpswox_name,
      status,
      tracker_phone,
      tracker_model,
      tracker_model_id,
      tracker_imei,
    });

    await getAuditService().adminAction('vehicle.create', {
      resourceType: 'vehicle',
      resourceId: data.id,
      metadata: { plate: data.plate, user_id },
      req,
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { plate, brand, model, color, year, gpswox_device_id, gpswox_name, status, tracker_phone, tracker_model, tracker_imei } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status inválido.' });
    }

    const data = await getVehicleService().update(req.params.id, {
      plate,
      brand,
      model,
      color,
      year,
      gpswox_device_id,
      gpswox_name,
      status,
      tracker_phone,
      tracker_model,
      tracker_model_id,
      tracker_imei,
    });

    await getAuditService().adminAction('vehicle.update', {
      resourceType: 'vehicle',
      resourceId: data.id,
      metadata: {
        plate: data.plate,
        tracker_phone_changed: Boolean(tracker_phone),
        status: data.status,
      },
      req,
    });

    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/sync-gpswox', async (req, res) => {
  try {
    const { getGpswoxSyncService } = require('../../../services/gpswox-sync-service');
    const { dry_run: dryRun, default_user_id: defaultUserId } = req.body;
    const summary = await getGpswoxSyncService().syncAndAudit(
      { dryRun: Boolean(dryRun), defaultUserId: defaultUserId ? Number(defaultUserId) : undefined },
      req,
    );
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
