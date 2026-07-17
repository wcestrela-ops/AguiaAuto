const { Router } = require('express');
const path = require('path');
const { getVehicleFleetService } = require('../../../services/vehicle-fleet-service');
const { getFleetReminderService } = require('../../../services/fleet-reminder-service');
const { getFleetReminderNotificationRepository } = require('../../../repositories/fleet-reminder-notification-repository');
const { getAuditService } = require('../../../services/audit-service');
const { vehicleDocumentUpload, storeVehicleDocumentFile } = require('../../../lib/upload');

const router = Router();

function getService() {
  return getVehicleFleetService();
}

router.get('/documentos', async (req, res) => {
  try {
    const data = await getService().adminListDocuments(req.tenantId);
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
      req.tenantId,
    );
    await getAuditService().adminAction('fleet.document.create', {
      resourceType: 'vehicle',
      resourceId: req.params.vehicleId,
      metadata: { document_id: data.id, title: data.title, doc_type: data.doc_type, plate: data.plate },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/documentos/:id', vehicleDocumentUpload.single('file'), async (req, res) => {
  try {
    const fileMeta = storeVehicleDocumentFile(req.file, req.body?.vehicle_id);
    const data = await getService().adminUpdateDocument(Number(req.params.id), req.body, fileMeta, req.tenantId);
    await getAuditService().adminAction('fleet.document.update', {
      resourceType: 'vehicle',
      resourceId: data.vehicle_id,
      metadata: { document_id: data.id, title: data.title, doc_type: data.doc_type, plate: data.plate },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/documentos/:id', async (req, res) => {
  try {
    const data = await getService().adminDeleteDocument(Number(req.params.id), req.tenantId);
    await getAuditService().adminAction('fleet.document.delete', {
      resourceType: 'vehicle',
      resourceId: data.vehicle_id,
      metadata: { document_id: data.id, title: data.title, plate: data.plate },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  try {
    const file = await getService().adminGetDocumentFile(Number(req.params.id), req.tenantId);
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
    const data = await getService().adminListMaintenance(req.tenantId);
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

    const data = await getService().adminCreateMaintenance(req.body, req.tenantId);
    await getAuditService().adminAction('fleet.maintenance.create', {
      resourceType: 'vehicle',
      resourceId: data.vehicle_id,
      metadata: { maintenance_id: data.id, title: data.title, plate: data.plate },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().adminUpdateMaintenance(Number(req.params.id), req.body, req.tenantId);
    await getAuditService().adminAction('fleet.maintenance.update', {
      resourceType: 'vehicle',
      resourceId: data.vehicle_id,
      metadata: { maintenance_id: data.id, title: data.title, plate: data.plate },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().adminDeleteMaintenance(Number(req.params.id), req.tenantId);
    await getAuditService().adminAction('fleet.maintenance.delete', {
      resourceType: 'vehicle',
      resourceId: data.vehicle_id,
      metadata: { maintenance_id: data.id, title: data.title, plate: data.plate },
      req,
    });
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
    const repo = getFleetReminderNotificationRepository();
    const [status, notifications, runs] = await Promise.all([
      getFleetReminderService().getStatus(),
      repo.listRecent({ limit, userId, tenantId: req.tenantId }),
      repo.listRecentRuns({ limit: 10, tenantId: req.tenantId }),
    ]);
    res.json({ success: true, data: { status, notifications, runs } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/lembretes/executar', async (req, res) => {
  try {
    const result = await getFleetReminderService().runScheduledReminders({ force: true });
    await getAuditService().adminAction('fleet.reminder.run', {
      resourceType: 'integration',
      resourceId: 'frota',
      metadata: {
        manual: true,
        skipped: Boolean(result.skipped),
        reason: result.reason || null,
        reminders_sent: result.reminders_sent ?? 0,
        errors_count: result.errors_count ?? 0,
      },
      req,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
