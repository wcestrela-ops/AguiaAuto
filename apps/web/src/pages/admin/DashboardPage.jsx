import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { HelpButton, InlineGuide } from '../../components/HelpGuide';

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

export default function DashboardPage() {
  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState('');

  useEffect(() => {
    api.getAdminOperationsDashboard()
      .then((res) => setOps(res.data))
      .catch((err) => setOpsError(err.message))
      .finally(() => setOpsLoading(false));
  }, []);

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
        <h3>Operação — o que precisa de atenção</h3>
        <InlineGuide guideId="operational_dashboard" />

        {opsLoading && <p className="muted">Carregando indicadores...</p>}
        {opsError && <div className="alert error">{opsError}</div>}

        {ops && (
          <>
            {ops.alerts.length === 0 ? (
              <div className="alert success">Nenhum alerta operacional no momento.</div>
            ) : (
              <div className="ops-alert-grid">
                {ops.alerts.map((alert) => (
                  <Link key={alert.key} to={alert.link} className={`ops-alert-card ops-${alert.severity}`}>
                    <span className={`badge ${SEVERITY_CLASS[alert.severity] || 'info'}`}>
                      {alert.count}
                    </span>
                    <div>
                      <strong>{alert.title}</strong>
                      {alert.hint && <p className="guide-inline">{alert.hint}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {(ops.details?.recent_failed_commands?.length > 0 || ops.details?.recent_failed_sms?.length > 0) && (
              <div className="ops-details-grid">
                {ops.details.recent_failed_commands?.length > 0 && (
                  <div className="table-card">
                    <h4>Últimos comandos com falha</h4>
                    <table>
                      <thead>
                        <tr><th>Placa</th><th>Ação</th><th>Canal</th><th>Quando</th></tr>
                      </thead>
                      <tbody>
                        {ops.details.recent_failed_commands.map((row) => (
                          <tr key={row.id}>
                            <td>{row.plate}</td>
                            <td>{row.action}</td>
                            <td>{row.channel}</td>
                            <td><small>{new Date(row.created_at).toLocaleString('pt-BR')}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {ops.details.recent_failed_sms?.length > 0 && (
                  <div className="table-card">
                    <h4>Últimos SMS com falha</h4>
                    <table>
                      <thead>
                        <tr><th>Telefone</th><th>Ação</th><th>Quando</th></tr>
                      </thead>
                      <tbody>
                        {ops.details.recent_failed_sms.map((row) => (
                          <tr key={row.id}>
                            <td>{row.phone}</td>
                            <td>{row.action || '—'}</td>
                            <td><small>{new Date(row.created_at).toLocaleString('pt-BR')}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
