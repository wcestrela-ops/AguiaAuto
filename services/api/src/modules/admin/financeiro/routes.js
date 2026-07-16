const { Router } = require('express');
const { getFinanceiroService } = require('../../../services/financeiro-service');
const { getProvisioningService } = require('../../../services/provisioning-service');
const { getUserRepository } = require('../../../repositories/user-repository');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/cobranca/status', async (req, res) => {
  try {
    const { getBillingReminderService } = require('../../../services/billing-reminder-service');
    const data = await getBillingReminderService().getStatus();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cobrancas/:id/baixa-manual', async (req, res) => {
  try {
    const { notes, send_notification } = req.body;
    const data = await getFinanceiroService().markManualPayment(req.params.id, {
      notes,
      send_notification: send_notification !== false,
    });
    await getAuditService().adminAction('billing.manual_payment', {
      resourceType: 'user',
      resourceId: data.user_id,
      metadata: {
        invoice_id: req.params.id,
        value: data.amount,
        send_notification: send_notification !== false,
      },
      req,
    });
    res.json({
      success: true,
      data,
      message: 'Baixa manual registrada.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/notificacoes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const channel = req.query.channel || undefined;
    const invoiceId = req.query.invoice_id ? parseInt(req.query.invoice_id, 10) : undefined;
    const data = await getFinanceiroService().listBillingNotifications({ limit, channel, invoiceId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/cobrancas', async (req, res) => {
  try {
    const data = await getFinanceiroService().listAllCharges();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cobrancas', async (req, res) => {
  try {
    const { user_id, value, due_date, billing_type, description, plan_id, charge_type } = req.body;

    if (!user_id || value == null || !due_date) {
      return res.status(400).json({
        success: false,
        error: 'user_id, value e due_date são obrigatórios.',
      });
    }

    const data = await getFinanceiroService().createCharge({
      user_id,
      value,
      due_date,
      billing_type: billing_type || 'PIX',
      description,
      plan_id,
      charge_type: charge_type || 'monthly',
    });

    await getAuditService().adminAction('billing.charge.create', {
      resourceType: 'user',
      resourceId: user_id,
      metadata: { invoice_id: data.id, value: data.amount, due_date, billing_type: billing_type || 'PIX' },
      req,
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/gateways', async (req, res) => {
  try {
    const data = await getFinanceiroService().getGatewayStatus();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/clientes/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const users = getUserRepository();
    const financeiro = getFinanceiroService();

    const user = await users.findByIdWithProvisioning(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const [resumo, faturas, mensalidades] = await Promise.all([
      financeiro.getResumo(userId),
      financeiro.listFaturas(userId),
      financeiro.getMensalidades(userId),
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          asaas_customer_id: user.asaas_customer_id,
          tracker_user_id: user.tracker_user_id,
          provisioning_status: user.provisioning_status,
          provisioning_errors: user.provisioning_errors,
        },
        resumo,
        faturas,
        mensalidades,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/provisionar/:userId', async (req, res) => {
  try {
    const { plan_id, billing_type } = req.body;
    const data = await getProvisioningService().provisionNewClient(req.params.userId, {
      plan_id,
      billing_type,
    });
    await getAuditService().adminAction('provisioning.run', {
      resourceType: 'user',
      resourceId: req.params.userId,
      metadata: { plan_id, billing_type, status: data.status },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/reprovisionar/:userId', async (req, res) => {
  try {
    const data = await getProvisioningService().retryProvisioning(req.params.userId);
    await getAuditService().adminAction('provisioning.retry', {
      resourceType: 'user',
      resourceId: req.params.userId,
      metadata: { status: data.status },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
