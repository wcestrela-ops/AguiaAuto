const { Router } = require('express');
const { getUserRepository } = require('../../../repositories/user-repository');
const whatsapp = require('../../../services/whatsapp');
const { normalizePhone } = require('../../../lib/phone');
const logger = require('../../../logger');

const router = Router();

router.post('/promocao', async (req, res) => {
  try {
    const { message, user_ids: userIds, all_clients: allClients } = req.body;

    if (!message || String(message).trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Mensagem obrigatória (mínimo 10 caracteres).',
      });
    }

    const users = getUserRepository();
    let targets = [];

    if (allClients) {
      const list = await users.listAll(req.tenantId);
      targets = list.filter(u => u.phone && u.active !== false);
    } else if (Array.isArray(userIds) && userIds.length) {
      for (const id of userIds) {
        const user = await users.findByIdWithProvisioning(id);
        if (user?.phone) targets.push(user);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Informe user_ids ou all_clients: true.',
      });
    }

    if (!targets.length) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum cliente com telefone encontrado.',
      });
    }

    const sent = [];
    const failed = [];

    for (const user of targets) {
      try {
        await whatsapp.sendText({
          to: normalizePhone(user.phone),
          text: message.trim(),
        }, { user: user.email, type: 'promocao' });
        sent.push({ id: user.id, email: user.email });
      } catch (err) {
        failed.push({ id: user.id, email: user.email, error: err.message });
        logger.warn('Falha promoção WhatsApp.', { userId: user.id, err: err.message });
      }
    }

    res.json({
      success: sent.length > 0,
      data: { sent: sent.length, failed: failed.length, details: { sent, failed } },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
