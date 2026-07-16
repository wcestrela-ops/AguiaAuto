const { Router } = require('express');
const { getVehicleService } = require('../../../services/vehicle-service');
const { getUserRepository } = require('../../../repositories/user-repository');
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
    const { user_id, plate, brand, model, color, year, gpswox_device_id, gpswox_name, status, tracker_phone } = req.body;

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
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { plate, brand, model, color, year, gpswox_device_id, gpswox_name, status, tracker_phone } = req.body;

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
    });

    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
