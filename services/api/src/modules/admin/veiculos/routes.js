const { Router } = require('express');
const { getVehicleService } = require('../../../services/vehicle-service');
const { getUserRepository } = require('../../../repositories/user-repository');
const { getAuditService } = require('../../../services/audit-service');
const { normalizeVehicleInput } = require('../../../lib/tracker-fields');
const { VEHICLE_STATUS } = require('../../../repositories/vehicle-repository');

const router = Router();

const VALID_STATUSES = Object.values(VEHICLE_STATUS);

router.get('/', async (req, res) => {
  try {
    const filters = {
      q: req.query.q?.trim() || undefined,
      status: req.query.status || undefined,
      user_id: req.query.user_id || undefined,
      issue: req.query.issue || undefined,
      sort: req.query.sort || undefined,
    };

    const service = getVehicleService();
    const [vehicles, total] = await Promise.all([
      service.listForAdmin(filters),
      service.countForAdmin(filters),
    ]);

    res.json({
      success: true,
      data: {
        vehicles,
        total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = normalizeVehicleInput(req.body);
    const { user_id, plate, brand, model, color, year, status, tracker_phone, tracker_model, tracker_model_id, tracker_imei } = { ...req.body, ...fields };
    const { tracker_device_id, tracker_name, tracking_provider } = fields;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id é obrigatório.' });
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
      tracking_provider,
      tracker_device_id,
      tracker_name,
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
    const fields = normalizeVehicleInput(req.body);
    const { plate, brand, model, color, year, status, tracker_phone, tracker_model, tracker_imei } = req.body;
    const { tracker_device_id, tracker_name, tracking_provider } = fields;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status inválido.' });
    }

    const data = await getVehicleService().update(req.params.id, {
      plate,
      brand,
      model,
      color,
      year,
      tracker_device_id,
      tracker_name,
      tracking_provider,
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

async function handleSyncTracker(req, res) {
  try {
    const { getGpswoxSyncService } = require('../../../services/gpswox-sync-service');
    const { dry_run: dryRun, default_user_id: defaultUserId, provider } = req.body;
    const summary = await getGpswoxSyncService().syncAndAudit(
      {
        dryRun: Boolean(dryRun),
        defaultUserId: defaultUserId ? Number(defaultUserId) : undefined,
        provider: provider || null,
      },
      req,
    );
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleSyncTrackerStatus(req, res) {
  try {
    const { getGpswoxSyncService } = require('../../../services/gpswox-sync-service');
    const data = await getGpswoxSyncService().getStatus();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

router.post('/sync-tracker', handleSyncTracker);
router.post('/sync-gpswox', handleSyncTracker);

router.patch('/:id/instalador', async (req, res) => {
  try {
    const { installer_id, installation_scheduled_at } = req.body;

    const data = await getVehicleService().assignInstaller(req.params.id, {
      installer_id,
      installation_scheduled_at,
    });

    await getAuditService().adminAction('vehicle.assign_installer', {
      resourceType: 'vehicle',
      resourceId: data.id,
      metadata: {
        installer_id: data.assigned_installer_id,
        installation_scheduled_at: data.installation_scheduled_at,
        plate: data.plate,
      },
      req,
    });

    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/:id/instalador', async (req, res) => {
  try {
    const data = await getVehicleService().unassignInstaller(req.params.id);

    await getAuditService().adminAction('vehicle.unassign_installer', {
      resourceType: 'vehicle',
      resourceId: data.id,
      metadata: { plate: data.plate },
      req,
    });

    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/sync-tracker/status', handleSyncTrackerStatus);
router.get('/sync-gpswox/status', handleSyncTrackerStatus);

module.exports = router;
