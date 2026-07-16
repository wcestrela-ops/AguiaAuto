const { Router } = require('express');
const path = require('path');
const { getVehicleFleetService } = require('../../services/vehicle-fleet-service');
const { vehicleDocumentUpload, storeVehicleDocumentFile } = require('../../lib/upload');

const router = Router();

function getService() {
  return getVehicleFleetService();
}

router.get('/', async (req, res) => {
  try {
    const data = await getService().getOverview(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/documentos', async (req, res) => {
  try {
    const data = await getService().listDocumentsForUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/documentos/veiculos/:vehicleId', vehicleDocumentUpload.single('file'), async (req, res) => {
  try {
    const fileMeta = storeVehicleDocumentFile(req.file, req.params.vehicleId);
    const data = await getService().createDocument(
      req.user.id,
      Number(req.params.vehicleId),
      req.body,
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
    const data = await getService().updateDocument(
      req.user.id,
      Number(req.params.id),
      req.body,
      fileMeta,
    );
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/documentos/:id', async (req, res) => {
  try {
    const data = await getService().deleteDocument(req.user.id, Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  try {
    const file = await getService().getDocumentFile(req.user.id, Number(req.params.id));
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
    const data = await getService().listMaintenanceForUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/manutencao/veiculos/:vehicleId', async (req, res) => {
  try {
    const data = await getService().createMaintenance(
      req.user.id,
      Number(req.params.vehicleId),
      req.body,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().updateMaintenance(
      req.user.id,
      Number(req.params.id),
      req.body,
    );
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/manutencao/:id', async (req, res) => {
  try {
    const data = await getService().deleteMaintenance(req.user.id, Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
