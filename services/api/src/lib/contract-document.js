function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function buildInstallationSection(delivery, deliveryTemplateHtml = '') {
  const label = delivery.vehicle_label || delivery.plate || 'Veículo';
  return `
    <section class="installation-block">
      <h3>Dados da instalação — ${escapeHtml(label)}</h3>
      <table class="meta-table">
        <tr><th>Placa</th><td>${escapeHtml(delivery.plate)}</td></tr>
        <tr><th>Instalador</th><td>${escapeHtml(delivery.installer_name || '—')}</td></tr>
        <tr><th>Device ID</th><td>${escapeHtml(delivery.gpswox_device_id || '—')}</td></tr>
        <tr><th>IMEI</th><td>${escapeHtml(delivery.imei || '—')}</td></tr>
        <tr><th>Duração</th><td>${escapeHtml(formatDuration(delivery.duration_minutes))}</td></tr>
        <tr><th>Data</th><td>${escapeHtml(formatDateTime(delivery.finished_at || delivery.created_at))}</td></tr>
      </table>
      ${delivery.report ? `<div class="report"><h4>Relatório do instalador</h4><p>${escapeHtml(delivery.report)}</p></div>` : ''}
      ${delivery.notes ? `<p><strong>Observações:</strong> ${escapeHtml(delivery.notes)}</p>` : ''}
      ${deliveryTemplateHtml ? `<div class="terms">${deliveryTemplateHtml}</div>` : ''}
    </section>
  `;
}

function wrapDocument({ title, body, clientName, clientEmail, acceptedAt }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 24px; line-height: 1.5; }
    h1, h2, h3 { font-family: system-ui, sans-serif; }
    .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 24px; }
    .meta { color: #444; font-size: 14px; margin-top: 8px; }
    .installation-block { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .meta-table th { text-align: left; width: 140px; padding: 6px 8px; background: #f5f5f5; }
    .meta-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    .report { background: #fafafa; padding: 12px; border-radius: 6px; }
    .footer { margin-top: 32px; font-size: 13px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <div><strong>Cliente:</strong> ${escapeHtml(clientName || '—')} (${escapeHtml(clientEmail || '—')})</div>
      ${acceptedAt ? `<div><strong>Aceite em:</strong> ${escapeHtml(formatDateTime(acceptedAt))}</div>` : ''}
    </div>
  </div>
  ${body}
  <div class="footer">
    Documento gerado pela Águia Gestão Veicular. Guarde uma cópia para seus registros.
  </div>
</body>
</html>`;
}

function buildFullContractDocument({
  serviceTemplate,
  deliveryTemplate,
  installations = [],
  clientName,
  clientEmail,
  acceptedAt = null,
}) {
  const installationHtml = installations.length
    ? `<h2>Dados das instalações</h2>${installations.map((d) => buildInstallationSection(d, deliveryTemplate?.body_html || '')).join('')}`
    : '';

  const body = `
    <div class="service-contract">${serviceTemplate?.body_html || ''}</div>
    ${installationHtml}
  `;

  return wrapDocument({
    title: serviceTemplate?.title || 'Contrato Águia Gestão Veicular',
    body,
    clientName,
    clientEmail,
    acceptedAt,
  });
}

function buildInstallationDocument({
  delivery,
  deliveryTemplate,
  clientName,
  clientEmail,
  acceptedAt,
}) {
  const body = buildInstallationSection(delivery, deliveryTemplate?.body_html || '');
  return wrapDocument({
    title: `Termo de Entrega — ${delivery.plate || delivery.vehicle_label || 'Veículo'}`,
    body,
    clientName,
    clientEmail,
    acceptedAt,
  });
}

module.exports = {
  buildFullContractDocument,
  buildInstallationDocument,
  buildInstallationSection,
  wrapDocument,
};
