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
  return buildAggregatedBillingVars({
    user,
    openInvoices: [invoice],
    daysOverdue,
    linkOverride: link,
  });
}

function buildAggregatedBillingVars({
  user,
  openInvoices = [],
  daysOverdue = 0,
  linkOverride = null,
}) {
  if (!openInvoices.length) {
    return {
      cliente: user?.name || user?.email || 'Cliente',
      valor: '0,00',
      total_valor: '0,00',
      vencimento: '—',
      link: '',
      pix: '',
      descricao: '',
      dias_atraso: String(daysOverdue),
      faturas_pendentes: '0',
      meses_atraso: '0',
      meses_em_aberto: '0',
      lista_faturas: '',
      detalhe_faturas: '',
      resumo_valor: '',
      resumo_vencimento: '',
      resumo_atraso: '',
      pix_ou_link: '',
      data_pagamento: formatDateTimeBr(new Date()),
    };
  }

  const sorted = [...openInvoices].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );
  const total = sorted.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const count = sorted.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = sorted.filter((inv) => {
    if (inv.status === 'overdue') return true;
    if (!inv.due_date) return false;
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    return inv.status === 'pending' && due < today;
  }).length;

  const listaLinhas = sorted.map((inv) => {
    const parts = [
      formatDateBr(inv.due_date),
      inv.description || 'Mensalidade',
      `R$ ${formatMoney(inv.amount)}`,
    ];
    if (inv.pix_copy_paste) {
      parts.push(`PIX: ${inv.pix_copy_paste}`);
    } else if (inv.invoice_url) {
      parts.push(`Link: ${inv.invoice_url}`);
    }
    return `• ${parts.join(' · ')}`;
  });

  const primary = sorted[0];
  const primaryPix = primary.pix_copy_paste
    || sorted.find((inv) => inv.pix_copy_paste)?.pix_copy_paste
    || '';
  const primaryLink = linkOverride
    || primary.invoice_url
    || sorted.find((inv) => inv.invoice_url)?.invoice_url
    || '';

  let pixOuLink = '';
  if (primaryPix) {
    pixOuLink = count > 1
      ? `PIX Copia e Cola (fatura mais antiga — pague as ${count} em sequência ou pelo app):\n${primaryPix}`
      : `PIX Copia e Cola:\n${primaryPix}`;
  } else if (primaryLink) {
    pixOuLink = count > 1
      ? `Link de pagamento (fatura mais antiga):\n${primaryLink}\n\nDemais faturas disponíveis no app Águia.`
      : `Pague aqui: ${primaryLink}`;
  }

  const detalheFaturas = count > 1
    ? `\n📋 Faturas em aberto (${count}):\n${listaLinhas.join('\n')}\n`
    : '';

  const resumoValor = count > 1
    ? `Você possui ${count} fatura(s) em aberto totalizando R$ ${formatMoney(total)}.`
    : `Valor: R$ ${formatMoney(primary.amount)}\nVencimento: ${formatDateBr(primary.due_date)}`;

  const resumoVencimento = count > 1
    ? `Total em aberto: R$ ${formatMoney(total)} (${count} fatura(s)).`
    : `Valor: R$ ${formatMoney(primary.amount)} · Vencimento: ${formatDateBr(primary.due_date)}`;

  const resumoAtraso = count > 1
    ? `Você possui ${count} fatura(s) em atraso totalizando R$ ${formatMoney(total)} (${overdueCount} mês(es)).`
    : `Sua fatura está ${daysOverdue} dia(s) em atraso.\nValor: R$ ${formatMoney(primary.amount)}`;

  return {
    cliente: user?.name || user?.email || 'Cliente',
    valor: formatMoney(count === 1 ? primary.amount : total),
    total_valor: formatMoney(total),
    vencimento: formatDateBr(primary.due_date),
    link: primaryLink,
    pix: primaryPix,
    descricao: count === 1
      ? (primary.description || 'Mensalidade')
      : `${count} faturas pendentes`,
    dias_atraso: String(daysOverdue),
    faturas_pendentes: String(count),
    meses_atraso: String(overdueCount),
    meses_em_aberto: String(count),
    lista_faturas: listaLinhas.join('\n'),
    detalhe_faturas: detalheFaturas,
    resumo_valor: resumoValor,
    resumo_vencimento: resumoVencimento,
    resumo_atraso: resumoAtraso,
    pix_ou_link: pixOuLink,
    data_pagamento: formatDateTimeBr(new Date()),
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
  buildAggregatedBillingVars,
  getBillingConfig,
  getEnabledReminderOffsets,
};
