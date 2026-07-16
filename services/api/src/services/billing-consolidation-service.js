const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getPaymentGatewayService } = require('../payments/payment-gateway-service');
const { buildAggregatedBillingVars } = require('../lib/billing-templates');
const logger = require('../logger');

async function refreshInvoicePayment(invoice) {
  const externalId = invoice.external_payment_id || invoice.asaas_payment_id;
  if (!externalId || !invoice.payment_provider) {
    return invoice;
  }

  try {
    const payments = getPaymentGatewayService();
    const payment = await payments.refreshPayment(invoice.payment_provider, externalId);
    const updated = await getInvoiceRepository().upsertFromPayment({
      user_id: invoice.user_id,
      subscription_id: invoice.subscription_id,
      description: invoice.description,
      is_initial_charge: invoice.is_initial_charge,
      ...payment,
    });
    return updated;
  } catch (err) {
    logger.warn('Falha ao atualizar PIX/link da fatura.', {
      invoiceId: invoice.id,
      err: err.message,
    });
    return invoice;
  }
}

async function prepareConsolidatedBillingContext(userId, { daysOverdue = 0 } = {}) {
  const invoices = getInvoiceRepository();
  const users = getUserRepository();

  const user = await users.findById(userId);
  if (!user) return null;

  const openInvoices = await invoices.listOpenInvoicesForUser(userId);
  if (!openInvoices.length) return null;

  const refreshedInvoices = [];
  for (const invoice of openInvoices) {
    refreshedInvoices.push(await refreshInvoicePayment(invoice));
  }

  const sortedInvoices = [...refreshedInvoices].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );

  const vars = buildAggregatedBillingVars({
    user,
    openInvoices: sortedInvoices,
    daysOverdue,
  });

  const primaryInvoice = sortedInvoices[0];
  const hasPayment = Boolean(vars.link || vars.pix);

  return {
    user,
    openInvoices: sortedInvoices,
    primaryInvoice,
    vars,
    hasPayment,
  };
}

module.exports = {
  refreshInvoicePayment,
  prepareConsolidatedBillingContext,
};
