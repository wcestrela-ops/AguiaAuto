const { getStore } = require('@aguia/integrations');
const { getDefaults } = require('@aguia/integrations');

const REMINDER_OFFSETS = [
  { days: 0, settingKey: 'remind_on_due_date', templateKey: 'template_due', trigger: 'billing.reminder.d0' },
  { days: 1, settingKey: 'remind_day_1', templateKey: 'template_overdue', trigger: 'billing.reminder.d1' },
  { days: 2, settingKey: 'remind_day_2', templateKey: 'template_overdue', trigger: 'billing.reminder.d2' },
  { days: 3, settingKey: 'remind_day_3', templateKey: 'template_overdue', trigger: 'billing.reminder.d3' },
  { days: 15, settingKey: 'remind_day_15', templateKey: 'template_overdue', trigger: 'billing.reminder.d15' },
];

function renderTemplate(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    return value != null && value !== '' ? String(value) : '';
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBr(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTimeBr(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function buildInvoiceMessageVars({ invoice, user, daysOverdue = 0, link = null }) {
  const paymentLink = link
    || invoice.invoice_url
    || (invoice.pix_copy_paste ? 'Use o código PIX no app Águia' : '');

  return {
    cliente: user?.name || user?.email || 'Cliente',
    valor: formatMoney(invoice.amount),
    vencimento: formatDateBr(invoice.due_date),
    link: paymentLink,
    descricao: invoice.description || 'Mensalidade',
    dias_atraso: String(daysOverdue),
    data_pagamento: formatDateTimeBr(invoice.paid_at || new Date()),
  };
}

async function getBillingConfig() {
  const defaults = getDefaults('cobranca');
  try {
    const store = getStore();
    const config = await store.get('cobranca');
    return {
      integrationEnabled: config.enabled !== false,
      ...defaults,
      ...(config.settings || {}),
    };
  } catch {
    return {
      integrationEnabled: false,
      ...defaults,
    };
  }
}

function getEnabledReminderOffsets(settings) {
  if (!settings.auto_reminders_enabled) return [];
  return REMINDER_OFFSETS.filter((offset) => settings[offset.settingKey] === true
    || settings[offset.settingKey] === 'true');
}

module.exports = {
  REMINDER_OFFSETS,
  renderTemplate,
  formatMoney,
  formatDateBr,
  formatDateTimeBr,
  buildInvoiceMessageVars,
  getBillingConfig,
  getEnabledReminderOffsets,
};
