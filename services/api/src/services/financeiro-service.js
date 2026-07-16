const { getUserRepository } = require('../repositories/user-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getPlanRepository } = require('../repositories/plan-repository');
const { getProvisioningService } = require('./provisioning-service');
const { getPaymentGatewayService } = require('../payments/payment-gateway-service');
const { sendBillingReminder } = require('./billing-notifications');
const { getBillingReminderService } = require('./billing-reminder-service');
const { getBillingNotificationRepository, formatNotification } = require('../repositories/billing-notification-repository');
const { getBillingConfig } = require('../lib/billing-templates');
const { normalizePhone } = require('../lib/phone');
const logger = require('../logger');

function formatInvoice(invoice) {
  const amount = Number(invoice.amount);
  const originalAmount = invoice.original_amount != null ? Number(invoice.original_amount) : null;
  return {
    id: invoice.id,
    description: invoice.description,
    amount,
    original_amount: originalAmount,
    discount_percent: invoice.discount_percent || null,
    due_date: invoice.due_date,
    status: invoice.status,
    billing_type: invoice.billing_type,
    payment_provider: invoice.payment_provider,
    is_initial_charge: invoice.is_initial_charge,
    invoice_url: invoice.invoice_url,
    bank_slip_url: invoice.bank_slip_url,
    pix_qrcode: invoice.pix_qrcode,
    pix_copy_paste: invoice.pix_copy_paste,
    paid_at: invoice.paid_at,
    paid_via: invoice.paid_via || null,
    manual_payment_notes: invoice.manual_payment_notes || null,
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
      proximo_gateway: nextDue?.payment_provider || null,
      plano: subscription ? {
        id: subscription.plan_id,
        nome: subscription.plan_name,
        valor_mensal: Number(subscription.price_monthly),
        gateway: subscription.payment_provider,
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
    this.payments = getPaymentGatewayService();
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
        payment_provider: subscription.payment_provider,
        inicio: subscription.starts_at,
      },
    };
  }

  async segundaVia(userId, invoiceId) {
    const invoice = await this.invoices.findByIdForUser(invoiceId, userId);
    if (!invoice) throw new Error('Fatura não encontrada.');

    const externalId = invoice.external_payment_id || invoice.asaas_payment_id;
    if (!externalId) throw new Error('Fatura sem vínculo de pagamento.');

    const payment = await this.payments.refreshPayment(invoice.payment_provider, externalId);
    const updated = await this.invoices.upsertFromPayment({
      user_id: userId,
      subscription_id: invoice.subscription_id,
      description: invoice.description,
      is_initial_charge: invoice.is_initial_charge,
      ...payment,
    });

    return formatInvoice(updated);
  }

  async createCharge({ user_id, value, due_date, billing_type = 'PIX', description, plan_id, charge_type = 'monthly' }) {
    const user = await this.users.findByIdWithProvisioning(user_id);
    if (!user) throw new Error('Usuário não encontrado.');

    await this.payments.ensureCustomers(user, this.users);
    const refreshed = await this.users.findByIdWithProvisioning(user_id);

    const payment = charge_type === 'initial'
      ? await this.payments.createInitialCharge({
        user: refreshed,
        plan: plan_id ? await this.plans.findById(plan_id) : { price_monthly: value, name: 'Avulso' },
        userId: user_id,
      })
      : await this.payments.createMonthlyCharge({
        user: refreshed,
        amount: value,
        dueDate: due_date,
        description: description || 'Mensalidade Águia',
        userId: user_id,
      });

    const subscription = plan_id
      ? await this.subscriptions.findActiveByUser(user_id)
      : null;

    const invoice = await this.invoices.upsertFromPayment({
      user_id,
      subscription_id: subscription?.id || null,
      description: description || 'Cobrança',
      is_initial_charge: charge_type === 'initial',
      billing_type: billing_type || payment.billing_type,
      ...payment,
    });

    const link = invoice.invoice_url || (invoice.pix_copy_paste ? 'Código PIX no app' : null);
    let notification = null;
    const billingSettings = await getBillingConfig();
    const notifyNewCharge = billingSettings.notify_on_new_charge !== false
      && billingSettings.notify_on_new_charge !== 'false';

    if (notifyNewCharge && refreshed.phone && link) {
      try {
        const result = await sendBillingReminder(
          normalizePhone(refreshed.phone),
          {
            valor: Number(invoice.amount).toFixed(2),
            vencimento: invoice.due_date,
            link,
            descricao: invoice.description || 'Cobrança',
          },
          {
            userId: user_id,
            user: refreshed.email,
            clientName: refreshed.name,
            invoiceId: invoice.id,
            trigger: 'billing.new_charge',
            templateKey: 'template_new_charge',
          },
        );
        notification = formatNotification(result.notification);
      } catch (err) {
        logger.warn('Falha ao enviar lembrete de cobrança.', { userId: user_id, err: err.message });
      }
    }

    return {
      ...formatInvoice(invoice),
      notification,
    };
  }

  async listAllCharges() {
    const rows = await this.invoices.listAll();
    const invoiceIds = rows.map((row) => row.id);
    const latestNotifications = await getBillingNotificationRepository()
      .mapLatestByInvoiceIds(invoiceIds);

    return rows.map((row) => ({
      ...formatInvoice(row),
      user_id: row.user_id,
      user_email: row.user_email,
      user_name: row.user_name,
      last_notification: latestNotifications.get(row.id) || null,
    }));
  }

  async listBillingNotifications(options = {}) {
    return getBillingNotificationRepository().listRecent(options);
  }

  async markManualPayment(invoiceId, { notes, send_notification = true } = {}) {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) throw new Error('Fatura não encontrada.');

    const updated = await this.invoices.markPaidManually(invoiceId, { notes });
    const user = await this.users.findById(updated.user_id);

    let notification = null;
    if (send_notification && user?.phone) {
      try {
        const result = await getBillingReminderService().notifyPaymentReceived(
          updated,
          user,
          { trigger: 'billing.payment_received.manual' },
        );
        if (result?.notification) {
          notification = formatNotification(result.notification);
        }
      } catch (err) {
        logger.warn('Falha ao notificar pagamento manual.', { invoiceId, err: err.message });
      }
    }

    return {
      ...formatInvoice(updated),
      user_id: updated.user_id,
      notification,
    };
  }

  async processWebhookEvent({ provider, event, payment }) {
    if (!payment?.external_payment_id && !payment?.asaas_payment_id) {
      return { processed: false, reason: 'Pagamento sem ID.' };
    }

    const paymentProvider = provider || payment.provider || 'asaas';
    const externalId = payment.external_payment_id || payment.asaas_payment_id;

    let targetUser = null;
    if (payment.customer_id || payment.external_customer_id) {
      const customerId = payment.customer_id || payment.external_customer_id;
      const allUsers = await this.users.listAll();
      targetUser = allUsers.find(u =>
        u.asaas_customer_id === customerId || u.mercadopago_payer_id === customerId || u.email === customerId
      );
    }

    if (!targetUser) {
      const existing = await this.invoices.findByExternalPayment(paymentProvider, externalId);
      if (existing) {
        targetUser = await this.users.findByIdWithProvisioning(existing.user_id);
      }
    }

    if (!targetUser) {
      return { processed: false, reason: 'Usuário não encontrado para o pagamento.' };
    }

    const subscription = await this.subscriptions.findActiveByUser(targetUser.id);
    const previous = externalId
      ? await this.invoices.findByExternalPayment(paymentProvider, externalId)
      : null;
    const wasPaid = previous?.status === 'paid';

    const invoice = await this.invoices.upsertFromPayment({
      user_id: targetUser.id,
      subscription_id: subscription?.id || null,
      payment_provider: paymentProvider,
      ...payment,
    });

    if (event === 'PAYMENT_OVERDUE' || payment.status === 'overdue') {
      logger.info('Pagamento em atraso.', { userId: targetUser.id, paymentId: externalId });
    }

    if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'payment.updated', 'payment.created'].includes(event)
      || payment.status === 'paid') {
      logger.info('Pagamento confirmado.', { userId: targetUser.id, paymentId: externalId, provider: paymentProvider });

      if (!wasPaid && invoice.status === 'paid' && targetUser.phone) {
        try {
          await getBillingReminderService().notifyPaymentReceived(
            invoice,
            targetUser,
            { trigger: 'billing.payment_received' },
          );
        } catch (err) {
          logger.warn('Falha ao notificar pagamento recebido.', { invoiceId: invoice.id, err: err.message });
        }
      }
    }

    return { processed: true, invoice_id: invoice.id, event, provider: paymentProvider };
  }

  async getGatewayStatus() {
    return this.payments.getStatus();
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
