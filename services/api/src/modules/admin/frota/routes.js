const { Router } = require('express');
const path = require('path');
const { getVehicleFleetService } = require('../../../services/vehicle-fleet-service');
const { getFleetReminderService } = require('../../../services/fleet-reminder-service');
const { getFleetReminderNotificationRepository } = require('../../../repositories/fleet-reminder-notification-repository');
const { vehicleDocumentUpload, storeVehicleDocumentFile } = require('../../../lib/upload');

const router = Router();

function getService() {
  return getVehicleFleetService();
}

router.get('/documentos', async (req, res) => {
  try {
    const data = await getService().adminListDocuments();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/documentos/veiculos/:vehicleId', vehicleDocumentUpload.single('file'), async (req, res) => {
  try {
    if (!req.body?.title?.trim()) throw new Error('Título é obrigatório.');

    const fileMeta = storeVehicleDocumentFile(req.file, req.params.vehicleId);
    const data = await getService().adminCreateDocument(
      { ...req.body, vehicle_id: req.params.vehicleId },
      fileMeta,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/documentos/:id', vehicleDocumentUpload.single('file'), async (req, res) => {
  try {
    const fileMeta = storeVehicleDocumentFile(req.file, req.body?.vehicle_id);
    const data = await getService().adminUpdateDocument(Number(req.params.id), req.body, fileMeta);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/documentos/:id', async (req, res) => {
  try {
    const data = await getService().adminDeleteDocument(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  try {
    const file = await getService().adminGetDocumentFile(Number(req.params.id));
    res.sendFile(path.resolve(file.path), {
      headers: { 'Content-Disposition': `inline; filename="${file.filename}"` },
    });
  } catch (err) {
    const status = err.message.includes('não encontrado') || err.message.includes('não disponível') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/manutencao', async (req, res) => {
  try {
    const data = await getService().adminListMaintenance();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/manutencao', async (req, res) => {
  try {
    if (!req.body?.vehicle_id) throw new Error('vehicle_id é obrigatório.');
    if (!req.body?.title?.trim()) throw new Error('Título é obrigatório.');
    if (!req.body?.performed_at) throw new Error('Data da manutenção é obrigatória.');

    const data = await getService().adminCreateMaintenance(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().adminUpdateMaintenance(Number(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().adminDeleteMaintenance(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/lembretes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : undefined;
    const [status, notifications] = await Promise.all([
      getFleetReminderService().getStatus(),
      getFleetReminderNotificationRepository().listRecent({ limit, userId }),
    ]);
    res.json({ success: true, data: { status, notifications } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/lembretes/executar', async (req, res) => {
  try {
    const result = await getFleetReminderService().runScheduledReminders();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
