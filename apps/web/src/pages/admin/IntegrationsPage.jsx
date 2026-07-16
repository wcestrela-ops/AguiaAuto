import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { HelpButton, PageHeaderWithHelp } from '../../components/HelpGuide';
import { getIntegrationGuide } from '../../content/admin-guides';

const ICONS = {
  rastreamento: '🔀',
  traccar: '🛰️',
  gpswox: '📍',
  asaas: '💰',
  mercadopago: '🛒',
  payment_gateways: '🔀',
  alertas: '🚨',
  firebase: '🔔',
  smtp: '✉️',
  sms_gpswox_gateway: '📲',
  cobranca: '💬',
  frota: '📋',
  emergencia: '🆘',
  gateway: '🔒',
  gateway_client: '🔗',
};

const INTEGRATION_GUIDE_MAP = {
  rastreamento: 'rastreamento',
  traccar: 'traccar',
  gpswox: 'gpswox',
  asaas: 'asaas',
  mercadopago: 'mercadopago',
  payment_gateways: 'payment_gateways',
  firebase: 'firebase',
  smtp: 'smtp',
  alertas: 'alertas',
  sms_gpswox_gateway: 'sms_gpswox_gateway',
  cobranca: 'cobranca',
  frota: 'frota',
  emergencia: 'emergencia',
};

export default function IntegrationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getIntegrations()
      .then((res) => setItems(res.data.filter((i) => !['gateway', 'gateway_client'].includes(i.key))))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeaderWithHelp
        title="Integrações"
        subtitle="Gerencie credenciais de APIs externas pelo painel admin."
        guideId="integrations"
      />

      <PageAlerts error={error} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="info-box">Nenhuma integração disponível.</div>
      ) : (
        <div className="card-grid">
          {items.map((item) => {
            const guideId = INTEGRATION_GUIDE_MAP[item.key];
            const guide = getIntegrationGuide(item.key);
            return (
              <Link key={item.key} to={`/admin/integracoes/${item.key}`} className="card card-link">
                <span className="card-icon">{ICONS[item.key] || '🔌'}</span>
                <div className="section-title-row">
                  <h3>{item.label}</h3>
                  {guideId && (
                    <HelpButton
                      guideId={guideId}
                      size="sm"
                      label={`Ajuda: ${item.label}`}
                    />
                  )}
                </div>
                <p>{item.description}</p>
                {guide?.summary && (
                  <p className="guide-inline" style={{ marginTop: '0.5rem' }}>{guide.summary}</p>
                )}
                <div className="card-meta">
                  <span className={`badge ${item.configured ? 'success' : 'warning'}`}>
                    {item.configured ? 'Configurado' : 'Pendente'}
                  </span>
                  {item.key === 'firebase' && (
                    <span className="badge info">Push Notifications</span>
                  )}
                  {item.key === 'payment_gateways' && (
                    <span className="badge info">Failover Asaas + MP</span>
                  )}
                  {item.key === 'mercadopago' && (
                    <span className="badge info">Pagamento inicial PIX</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
