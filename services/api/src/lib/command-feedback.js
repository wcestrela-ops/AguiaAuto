const CHANNEL_LABELS = {
  '4g': 'Rede 4G',
  sms: 'SMS (chip)',
};

const STATUS_LABELS = {
  sent: 'Enviado',
  queued: 'Na fila',
  processing: 'Processando',
  failed: 'Falhou',
  duplicate: 'Duplicado',
};

function normalizeSmsStatus(smsData) {
  if (!smsData) return 'sent';
  if (smsData.duplicate) return 'duplicate';
  const s = String(smsData.status || '').toLowerCase();
  if (['failed', 'queued', 'processing', 'sent'].includes(s)) return s;
  if (smsData.queued) return 'queued';
  return 'sent';
}

function buildCommandHint({ channel, failover, status, hasTrackerPhone }) {
  if (status === 'failed') {
    if (!hasTrackerPhone) {
      return 'Veículo sem chip SIM cadastrado — o backup por SMS não está disponível.';
    }
    return 'Não foi possível enviar o comando. Tente novamente ou contate o suporte.';
  }
  if (status === 'duplicate') {
    return 'Este comando já havia sido enviado há instantes (proteção anti-duplicidade).';
  }
  if (status === 'queued' || status === 'processing') {
    return 'SMS enfileirado — a confirmação pode levar alguns segundos.';
  }
  if (channel === 'sms' && failover) {
    return 'A rede 4G falhou; o comando foi enviado por SMS para o chip do rastreador.';
  }
  if (channel === 'sms') {
    return 'Comando enviado por SMS para o chip do rastreador.';
  }
  return 'Comando enviado pela internet do rastreador (4G).';
}

function buildCommandMessage({ label, channel, failover, status }) {
  const action = label || 'Comando';
  if (status === 'failed') return `${action} não foi enviado.`;
  if (status === 'duplicate') return `${action} já estava em processamento.`;
  if (status === 'queued' || status === 'processing') {
    return `${action} enfileirado via SMS.`;
  }
  if (channel === 'sms' && failover) {
    return `${action} enviado via SMS (4G indisponível).`;
  }
  if (channel === 'sms') {
    return `${action} enviado via SMS.`;
  }
  return `${action} enviado via rede 4G.`;
}

function formatCommandLogRow(row) {
  return {
    id: row.id,
    action: row.action,
    channel: row.channel,
    channel_label: CHANNEL_LABELS[row.channel] || row.channel,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    failover: Boolean(row.failover),
    error_message: row.error_message || null,
    created_at: row.created_at,
    hint: buildCommandHint({
      channel: row.channel,
      failover: row.failover,
      status: row.status,
      hasTrackerPhone: true,
    }),
  };
}

function buildCommandFeedback({
  action,
  label,
  channel,
  failover = false,
  status = 'sent',
  smsData = null,
  hasTrackerPhone = true,
  message = null,
}) {
  const deliveryStatus = smsData ? normalizeSmsStatus(smsData) : status;
  const feedback = {
    action,
    label,
    channel,
    channel_label: CHANNEL_LABELS[channel] || channel,
    failover: Boolean(failover),
    status: deliveryStatus,
    status_label: STATUS_LABELS[deliveryStatus] || deliveryStatus,
    success: deliveryStatus !== 'failed',
    hint: buildCommandHint({
      channel,
      failover,
      status: deliveryStatus,
      hasTrackerPhone,
    }),
    message: message || buildCommandMessage({
      label,
      channel,
      failover,
      status: deliveryStatus,
    }),
    dispatch_id: smsData?.dispatch_id || null,
    provider: smsData?.provider || null,
    duplicate: Boolean(smsData?.duplicate),
    queued: Boolean(smsData?.queued) || deliveryStatus === 'queued',
  };
  return feedback;
}

module.exports = {
  CHANNEL_LABELS,
  STATUS_LABELS,
  buildCommandFeedback,
  buildCommandHint,
  formatCommandLogRow,
  normalizeSmsStatus,
};
