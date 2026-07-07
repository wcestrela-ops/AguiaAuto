const asaas = require('../integrations/asaas');
const { getUserRepository } = require('../repositories/user-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getPlanRepository } = require('../repositories/plan-repository');
const { getProvisioningService } = require('./provisioning-service');
const whatsapp = require('./whatsapp');
const { normalizePhone } = require('../lib/phone');
const logger = require('../logger');

function formatInvoice(invoice) {
  return {
    id: invoice.id,
    description: invoice.description,
    amount: Number(invoice.amount),
    due_date: invoice.due_date,
    status: invoice.status,
    billing_type: invoice.billing_type,
    invoice_url: invoice.invoice_url,
    bank_slip_url: invoice.bank_slip_url,
    pix_qrcode: invoice.pix_qrcode,
    pix_copy_paste: invoice.pix_copy_paste,
    paid_at: invoice.paid_at,
    created_at: invoice.created_at,
  };
}

function buildFinancialSummary(userId) {
  return async () => {
    const invoices = getInvoiceRepository();
    const subscriptions = getSubscriptionRepository();

    const subscription = await subscriptions.findActiveByUser(userId);
    const nextDue = await invoices.getNextDueForUser(userId);
    const overdueCount = await invoices.countOverdueByUser(userId);

    let status = 'sem_cobranca';
    if (overdueCount > 0) status = 'atrasado';
    else if (nextDue) status = 'em_dia';
    else if (subscription) status = 'em_dia';

    return {
      status,
      proximo_vencimento: nextDue?.due_date || null,
      proximo_valor: nextDue ? Number(nextDue.amount) : null,
      plano: subscription ? {
        id: subscription.plan_id,
        nome: subscription.plan_name,
        valor_mensal: Number(subscription.price_monthly),
      } : null,
      faturas_pendentes: overdueCount + (nextDue ? 1 : 0),
    };
  };
}

class FinanceiroService {
  constructor() {
    this.users = getUserRepository();
    this.subscriptions = getSubscriptionRepository();
    this.invoices = getInvoiceRepository();
    this.plans = getPlanRepository();
  }

  async getResumo(userId) {
    return buildFinancialSummary(userId)();
  }

  async listFaturas(userId) {
    const rows = await this.invoices.listByUser(userId);
    return rows.map(formatInvoice);
  }

  async getMensalidades(userId) {
    const subscription = await this.subscriptions.findActiveByUser(userId);
    if (!subscription) {
      return { ativa: false, assinatura: null };
    }

    return {
      ativa: true,
      assinatura: {
        id: subscription.id,
        plano: subscription.plan_name,
        valor: Number(subscription.price_monthly),
        status: subscription.status,
        billing_type: subscription.billing_type,
        inicio: subscription.starts_at,
      },
    };
  }

  async segundaVia(userId, invoiceId) {
    const invoice = await this.invoices.findByIdForUser(invoiceId, userId);
    if (!invoice) throw new Error('Fatura não encontrada.');

    if (!invoice.asaas_payment_id) {
      throw new Error('Fatura sem vínculo Asaas.');
    }

    const payment = await asaas.getPayment(invoice.asaas_payment_id);
    const updated = await this.invoices.upsertFromAsaas({
      user_id: userId,
      subscription_id: invoice.subscription_id,
      ...payment,
      description: invoice.description,
    });

    return formatInvoice(updated);
  }

  async createCharge({ user_id, value, due_date, billing_type = 'UNDEFINED', description, plan_id }) {
    const user = await this.users.findByIdWithProvisioning(user_id);
    if (!user) throw new Error('Usuário não encontrado.');

    let customerId = user.asaas_customer_id;
    if (!customerId) {
      const provision = await getProvisioningService().provisionNewClient(user_id, { plan_id, billing_type });
      const refreshed = await this.users.findByIdWithProvisioning(user_id);
      customerId = refreshed?.asaas_customer_id;
      if (!customerId) {
        throw new Error(provision.errors?.[0]?.error || 'Não foi possível criar cliente no Asaas.');
      }
    }

    const payment = await asaas.createPayment({
      customerId,
      value,
      dueDate: due_date,
      billingType: billing_type,
      description,
    });

    const subscription = plan_id
      ? await this.subscriptions.findActiveByUser(user_id)
      : null;

    const invoice = await this.invoices.upsertFromAsaas({
      user_id,
      subscription_id: subscription?.id || null,
      description: description || 'Cobrança avulsa',
      ...payment,
    });

    if (user.phone && invoice.invoice_url) {
      try {
        await whatsapp.sendBillingReminder(normalizePhone(user.phone), {
          valor: Number(invoice.amount).toFixed(2),
          vencimento: invoice.due_date,
          link: invoice.invoice_url,
        }, { user: user.email });
      } catch (err) {
        logger.warn('Falha ao enviar cobrança via WhatsApp.', { userId: user_id, err: err.message });
      }
    }

    return formatInvoice(invoice);
  }

  async listAllCharges() {
    const rows = await this.invoices.listAll();
    return rows.map(row => ({
      ...formatInvoice(row),
      user_id: row.user_id,
      user_email: row.user_email,
      user_name: row.user_name,
    }));
  }

  async processWebhookEvent({ event, payment }) {
    if (!payment?.asaas_payment_id) {
      return { processed: false, reason: 'Pagamento sem ID.' };
    }

    let targetUser = null;
    if (payment.customer_id) {
      const allUsers = await this.users.listAll();
      targetUser = allUsers.find(u => u.asaas_customer_id === payment.customer_id);
    }

    if (!targetUser) {
      const existing = await this.invoices.findByAsaasPaymentId(payment.asaas_payment_id);
      if (existing) {
        targetUser = await this.users.findByIdWithProvisioning(existing.user_id);
      }
    }

    if (!targetUser) {
      return { processed: false, reason: 'Usuário não encontrado para o pagamento.' };
    }

    const subscription = await this.subscriptions.findActiveByUser(targetUser.id);
    const invoice = await this.invoices.upsertFromAsaas({
      user_id: targetUser.id,
      subscription_id: subscription?.id || null,
      ...payment,
    });

    if (event === 'PAYMENT_OVERDUE') {
      logger.info('Pagamento em atraso.', { userId: targetUser.id, paymentId: payment.asaas_payment_id });
    }

    if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
      logger.info('Pagamento confirmado.', { userId: targetUser.id, paymentId: payment.asaas_payment_id });
    }

    return { processed: true, invoice_id: invoice.id, event };
  }

  async listPlans() {
    return this.plans.listActive();
  }

  async listPlansAdmin() {
    return this.plans.listAll();
  }

  async createPlan(data) {
    if (!data.name || data.price_monthly == null) {
      throw new Error('Nome e preço são obrigatórios.');
    }
    return this.plans.create(data);
  }

  async updatePlan(id, data) {
    const plan = await this.plans.update(id, data);
    if (!plan) throw new Error('Plano não encontrado.');
    return plan;
  }
}

let instance = null;

function getFinanceiroService() {
  if (!instance) instance = new FinanceiroService();
  return instance;
}

module.exports = { FinanceiroService, getFinanceiroService, buildFinancialSummary, formatInvoice };
