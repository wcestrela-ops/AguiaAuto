import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { HelpButton, InlineGuide } from '../../components/HelpGuide';
import { fleetStatusBadgeClass, fleetStatusLabel } from '../../utils/fleet';

const CARDS = [
  { title: 'Integrações', desc: 'GPSWOX, Asaas, Firebase Push', to: '/admin/integracoes', icon: '⚙️', guideId: 'integrations' },
  { title: 'WhatsApp', desc: 'Evolution, WAHA, Meta Cloud', to: '/admin/whatsapp', icon: '💬', guideId: 'whatsapp' },
  { title: 'SMS Rastreador', desc: 'Comandos chip + gateways', to: '/admin/sms', icon: '📡', guideId: 'sms' },
  { title: 'Veículos', desc: 'GPSWOX, chip SIM, sync', to: '/admin/veiculos', icon: '🚗', guideId: 'vehicles' },
];

const SEVERITY_CLASS = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const ALERT_DETAIL_KEY = {
  vehicles_missing_chip: 'vehicles_missing_chip',
  vehicles_missing_device: 'vehicles_missing_device',
  vehicles_missing_imei: 'vehicles_missing_imei',
  vehicles_missing_model: 'vehicles_missing_model',
  pending_installations: 'pending_installations',
  provisioning_issues: 'provisioning_issues',
  failed_commands: 'recent_failed_commands',
  failed_sms: 'recent_failed_sms',
  billing_sms_fallback: 'recent_billing_sms_fallback',
  billing_notifications_failed: 'recent_billing_failed',
  overdue_invoices: 'overdue_invoices',
  fleet_documents_expired: 'fleet_expiring_documents',
  fleet_documents_expiring: 'fleet_expiring_documents',
  fleet_maintenance_overdue: 'fleet_due_maintenance',
  fleet_maintenance_due: 'fleet_due_maintenance',
  emergency_events_24h: 'emergency_recent',
  clients_inactive_access: 'inactive_access_clients',
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatPlate(plate) {
  return plate || 'Sem placa';
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function clientLabel(row) {
  return row.user_name || row.user_email || row.name || row.email || '—';
}

function hasDetailItems(ops, detailKey) {
  const items = ops?.details?.[detailKey];
  return Array.isArray(items) && items.length > 0;
}

function alertTarget(alert, ops) {
  const detailKey = ALERT_DETAIL_KEY[alert.key];
  if (detailKey && hasDetailItems(ops, detailKey)) {
    return { type: 'anchor', href: `#ops-${detailKey}` };
  }
  return { type: 'link', href: alert.link };
}

function OpsDetailCard({ id, title, children, footerLink, footerLabel = 'Ver todos' }) {
  return (
    <div className="table-card ops-detail-card" id={id}>
      <h4>{title}</h4>
      {children}
      {footerLink && (
        <div className="ops-detail-footer">
          <Link to={footerLink} className="btn-ghost btn-sm">{footerLabel}</Link>
        </div>
      )}
    </div>
  );
}

function VehicleRows({ rows, showStatus = false }) {
  return (
    <table>
      <thead>
        <tr><th>Placa</th><th>Cliente</th>{showStatus && <th>Status</th>}<th /></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{formatPlate(row.plate)}</td>
            <td>{clientLabel(row)}</td>
            {showStatus && <td><small>{row.status}</small></td>}
            <td>
              <Link to="/admin/veiculos" className="btn-ghost btn-sm">Veículos</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OpsDetailsGrid({ ops }) {
  const details = ops.details || {};
  const inactiveDays = ops.counts?.inactive_access_days || 30;

  const sections = [];

  if (details.pending_installations?.length > 0) {
    sections.push(
      <OpsDetailCard
        key="pending_installations"
        id="ops-pending_installations"
        title="Aguardando instalação"
        footerLink="/admin/veiculos?status=pending_installation"
        footerLabel="Ver veículos"
      >
        <VehicleRows rows={details.pending_installations} showStatus />
      </OpsDetailCard>,
    );
  }

  if (details.vehicles_missing_chip?.length > 0) {
    sections.push(
      <OpsDetailCard key="vehicles_missing_chip" id="ops-vehicles_missing_chip" title="Veículos sem chip SIM" footerLink="/admin/veiculos?issue=missing_chip">
        <VehicleRows rows={details.vehicles_missing_chip} showStatus />
      </OpsDetailCard>,
    );
  }

  if (details.vehicles_missing_imei?.length > 0) {
    sections.push(
      <OpsDetailCard key="vehicles_missing_imei" id="ops-vehicles_missing_imei" title="Veículos sem IMEI" footerLink="/admin/veiculos?issue=missing_imei">
        <VehicleRows rows={details.vehicles_missing_imei} showStatus />
      </OpsDetailCard>,
    );
  }

  if (details.vehicles_missing_model?.length > 0) {
    sections.push(
      <OpsDetailCard key="vehicles_missing_model" id="ops-vehicles_missing_model" title="Veículos sem modelo de rastreador" footerLink="/admin/veiculos?issue=missing_model">
        <VehicleRows rows={details.vehicles_missing_model} showStatus />
      </OpsDetailCard>,
    );
  }

  if (details.vehicles_missing_device?.length > 0) {
    sections.push(
      <OpsDetailCard key="vehicles_missing_device" id="ops-vehicles_missing_device" title="Veículos sem Device ID GPSWOX" footerLink="/admin/veiculos?issue=missing_device">
        <VehicleRows rows={details.vehicles_missing_device} showStatus />
      </OpsDetailCard>,
    );
  }

  if (details.provisioning_issues?.length > 0) {
    sections.push(
      <OpsDetailCard key="provisioning_issues" id="ops-provisioning_issues" title="Provisionamento incompleto" footerLink="/admin/financeiro">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Status</th><th>GPSWOX</th><th>Asaas</th><th /></tr>
          </thead>
          <tbody>
            {details.provisioning_issues.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td><small>{row.provisioning_status || 'pending'}</small></td>
                <td><small>{row.gpswox_user_id ? '✓' : '—'}</small></td>
                <td><small>{row.asaas_customer_id ? '✓' : '—'}</small></td>
                <td>
                  <Link to={`/admin/clientes/${row.id}`} className="btn-ghost btn-sm">Ficha</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.overdue_invoices?.length > 0) {
    sections.push(
      <OpsDetailCard key="overdue_invoices" id="ops-overdue_invoices" title="Faturas vencidas" footerLink="/admin/financeiro">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th /></tr>
          </thead>
          <tbody>
            {details.overdue_invoices.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td>{row.description || '—'}</td>
                <td>{formatMoney(row.amount)}</td>
                <td><small>{formatDate(row.due_date)}</small></td>
                <td>
                  {row.user_id && (
                    <Link to={`/admin/clientes/${row.user_id}`} className="btn-ghost btn-sm">Ficha</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.recent_billing_sms_fallback?.length > 0) {
    sections.push(
      <OpsDetailCard key="recent_billing_sms_fallback" id="ops-recent_billing_sms_fallback" title="Cobranças via SMS (fallback WhatsApp)" footerLink="/admin/financeiro">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Telefone</th><th>Fatura</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {details.recent_billing_sms_fallback.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td>{row.phone || '—'}</td>
                <td><small>{row.invoice_description || `#${row.invoice_id || '—'}`}</small></td>
                <td><small>{formatDateTime(row.created_at)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.recent_billing_failed?.length > 0) {
    sections.push(
      <OpsDetailCard key="recent_billing_failed" id="ops-recent_billing_failed" title="Lembretes de cobrança com falha" footerLink="/admin/financeiro">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Canal</th><th>Erro</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {details.recent_billing_failed.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td>{row.channel || '—'}{row.used_fallback ? ' (fallback)' : ''}</td>
                <td><small className="command-history-error">{row.error_message || '—'}</small></td>
                <td><small>{formatDateTime(row.created_at)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.recent_failed_commands?.length > 0) {
    sections.push(
      <OpsDetailCard key="recent_failed_commands" id="ops-recent_failed_commands" title="Últimos comandos com falha" footerLink="/admin/veiculos">
        <table>
          <thead>
            <tr><th>Placa</th><th>Ação</th><th>Canal</th><th>Erro</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {details.recent_failed_commands.map((row) => (
              <tr key={row.id}>
                <td>{formatPlate(row.plate)}</td>
                <td>{row.action}</td>
                <td>{row.channel}</td>
                <td><small className="command-history-error">{row.error_message || '—'}</small></td>
                <td><small>{formatDateTime(row.created_at)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.recent_failed_sms?.length > 0) {
    sections.push(
      <OpsDetailCard key="recent_failed_sms" id="ops-recent_failed_sms" title="Últimos SMS com falha" footerLink="/admin/sms">
        <table>
          <thead>
            <tr><th>Telefone</th><th>Ação</th><th>Erro</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {details.recent_failed_sms.map((row) => (
              <tr key={row.id}>
                <td>{row.phone}</td>
                <td>{row.action || '—'}</td>
                <td><small className="command-history-error">{row.error_message || '—'}</small></td>
                <td><small>{formatDateTime(row.created_at)}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.fleet_expiring_documents?.length > 0) {
    sections.push(
      <OpsDetailCard key="fleet_expiring_documents" id="ops-fleet_expiring_documents" title="Documentos de frota (vencendo ou vencidos)" footerLink="/admin/frota">
        <table>
          <thead>
            <tr><th>Placa</th><th>Documento</th><th>Vencimento</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {details.fleet_expiring_documents.map((row) => (
              <tr key={row.id}>
                <td>{formatPlate(row.plate)}</td>
                <td>{row.doc_type_label || row.title || '—'}</td>
                <td><small>{row.expiry_date_br || formatDate(row.expiry_date)}</small></td>
                <td>
                  <span className={`badge ${fleetStatusBadgeClass(row.expiry_status)}`}>
                    {fleetStatusLabel(row.expiry_status)}
                  </span>
                </td>
                <td>
                  {row.user_id && (
                    <Link to={`/admin/clientes/${row.user_id}`} className="btn-ghost btn-sm">Ficha</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.fleet_due_maintenance?.length > 0) {
    sections.push(
      <OpsDetailCard key="fleet_due_maintenance" id="ops-fleet_due_maintenance" title="Manutenções próximas ou em atraso" footerLink="/admin/frota">
        <table>
          <thead>
            <tr><th>Placa</th><th>Serviço</th><th>Próxima</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {details.fleet_due_maintenance.map((row) => (
              <tr key={row.id}>
                <td>{formatPlate(row.plate)}</td>
                <td>{row.service_type_label || row.title || '—'}</td>
                <td><small>{row.next_due_date_br || formatDate(row.next_due_date)}</small></td>
                <td>
                  <span className={`badge ${fleetStatusBadgeClass(row.due_status)}`}>
                    {fleetStatusLabel(row.due_status)}
                  </span>
                </td>
                <td>
                  {row.user_id && (
                    <Link to={`/admin/clientes/${row.user_id}`} className="btn-ghost btn-sm">Ficha</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.emergency_recent?.length > 0) {
    sections.push(
      <OpsDetailCard key="emergency_recent" id="ops-emergency_recent" title="Emergências recentes (SOS)" footerLink="/admin/emergencia">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Veículo</th><th>Local</th><th>Quando</th><th /></tr>
          </thead>
          <tbody>
            {details.emergency_recent.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td>{formatPlate(row.plate)}</td>
                <td><small>{row.address || (row.latitude != null ? `${row.latitude}, ${row.longitude}` : '—')}</small></td>
                <td><small>{formatDateTime(row.created_at)}</small></td>
                <td>
                  <Link to="/admin/emergencia" className="btn-ghost btn-sm">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (details.inactive_access_clients?.length > 0) {
    sections.push(
      <OpsDetailCard
        key="inactive_access_clients"
        id="ops-inactive_access_clients"
        title={`Clientes sem acesso recente (${inactiveDays}+ dias)`}
        footerLink={`/admin/clientes?access_inactive_days=${inactiveDays}&sort=last_access_asc`}
        footerLabel="Ver todos inativos"
      >
        <table>
          <thead>
            <tr><th>Cliente</th><th>Último acesso</th><th /></tr>
          </thead>
          <tbody>
            {details.inactive_access_clients.map((row) => (
              <tr key={row.id}>
                <td>{clientLabel(row)}</td>
                <td>
                  <small>
                    {row.last_access_at ? formatDateTime(row.last_access_at) : 'Nunca'}
                  </small>
                </td>
                <td>
                  <Link to={`/admin/clientes/${row.id}`} className="btn-ghost btn-sm">Ficha</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpsDetailCard>,
    );
  }

  if (ops.gpswox_sync && (ops.gpswox_sync.last_run || ops.gpswox_sync.auto_sync_enabled)) {
    const sync = ops.gpswox_sync;
    sections.push(
      <OpsDetailCard key="gpswox_sync" id="ops-gpswox_sync" title="Sync GPSWOX" footerLink="/admin/veiculos" footerLabel="Veículos e sync">
        <dl className="ops-sync-dl">
          <div><dt>Auto sync</dt><dd>{sync.auto_sync_enabled ? 'Ativo' : 'Desligado'}</dd></div>
          {sync.last_run && (
            <>
              <div><dt>Última execução</dt><dd>{formatDateTime(sync.last_run.finished_at || sync.last_run.started_at)}</dd></div>
              <div><dt>Resultado</dt><dd>{sync.last_run.success ? 'Sucesso' : 'Falhou'}</dd></div>
              {!sync.last_run.success && sync.last_run.error_message && (
                <div><dt>Erro</dt><dd><small className="command-history-error">{sync.last_run.error_message}</small></dd></div>
              )}
              {sync.unlinked_devices_last_success > 0 && (
                <div><dt>Dispositivos sem vínculo</dt><dd>{sync.unlinked_devices_last_success}</dd></div>
              )}
            </>
          )}
        </dl>
      </OpsDetailCard>,
    );
  }

  if (sections.length === 0) return null;

  return <div className="ops-details-grid">{sections}</div>;
}

function AlertCard({ alert, ops }) {
  const target = alertTarget(alert, ops);
  const className = `ops-alert-card ops-${alert.severity}`;
  const content = (
    <>
      <span className={`badge ${SEVERITY_CLASS[alert.severity] || 'info'}`}>
        {alert.count}
      </span>
      <div>
        <strong>{alert.title}</strong>
        {alert.hint && <p className="guide-inline">{alert.hint}</p>}
        {target.type === 'anchor' && (
          <small className="muted">Clique para ver detalhes abaixo</small>
        )}
      </div>
    </>
  );

  if (target.type === 'anchor') {
    return (
      <a href={target.href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={target.href} className={className}>
      {content}
    </Link>
  );
}

export default function DashboardPage() {
  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState('');

  const loadOps = useCallback(() => {
    setOpsLoading(true);
    setOpsError('');
    return api.getAdminOperationsDashboard()
      .then((res) => setOps(res.data))
      .catch((err) => setOpsError(err.message))
      .finally(() => setOpsLoading(false));
  }, []);

  useEffect(() => {
    loadOps();
  }, [loadOps]);

  return (
    <div>
      <header className="page-header">
        <div className="page-title-row">
          <h1>Dashboard</h1>
          <HelpButton guideId="dashboard" label="Primeiros passos" />
          <HelpButton guideId="operational_dashboard" size="sm" label="Painel operacional" />
        </div>
        <p>Configure APIs e integrações sem alterar código.</p>
        <InlineGuide guideId="dashboard" />
      </header>

      <section className="form-card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title-row">
          <h3>Operação — o que precisa de atenção</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={loadOps} disabled={opsLoading}>
            {opsLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
        <InlineGuide guideId="operational_dashboard" />

        {opsLoading && !ops && <p className="muted">Carregando indicadores...</p>}
        {opsError && <div className="alert error">{opsError}</div>}

        {ops && (
          <>
            {ops.generated_at && (
              <p className="muted" style={{ marginBottom: '0.75rem' }}>
                Atualizado em {formatDateTime(ops.generated_at)}
              </p>
            )}

            {ops.alerts.length === 0 ? (
              <div className="alert success">Nenhum alerta operacional no momento.</div>
            ) : (
              <div className="ops-alert-grid">
                {ops.alerts.map((alert) => (
                  <AlertCard key={alert.key} alert={alert} ops={ops} />
                ))}
              </div>
            )}

            <OpsDetailsGrid ops={ops} />
          </>
        )}
      </section>

      <div className="card-grid">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="card card-link">
            <span className="card-icon">{card.icon}</span>
            <div className="section-title-row">
              <h3>{card.title}</h3>
              <HelpButton guideId={card.guideId} size="sm" label={`Ajuda: ${card.title}`} />
            </div>
            <p>{card.desc}</p>
          </Link>
        ))}
      </div>

      <div className="info-box">
        <strong>Regra principal:</strong> Toda API/key (Firebase, WhatsApp, GPSWOX, Asaas) é
        configurada aqui no painel admin. Nunca no código-fonte.
      </div>
    </div>
  );
}
