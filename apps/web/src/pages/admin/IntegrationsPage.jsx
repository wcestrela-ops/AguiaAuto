import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const ICONS = {
  gpswox: '📍',
  asaas: '💰',
  firebase: '🔔',
  gateway: '🔒',
  gateway_client: '🔗',
};

export default function IntegrationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getIntegrations()
      .then((res) => setItems(res.data.filter(i => !['gateway', 'gateway_client'].includes(i.key))))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Carregando...</p>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <div>
      <header className="page-header">
        <h1>Configurações → Integrações</h1>
        <p>Gerencie credenciais de APIs externas pelo painel admin.</p>
      </header>

      <div className="card-grid">
        {items.map((item) => (
          <Link key={item.key} to={`/admin/integracoes/${item.key}`} className="card card-link">
            <span className="card-icon">{ICONS[item.key] || '🔌'}</span>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
            <div className="card-meta">
              <span className={`badge ${item.configured ? 'success' : 'warning'}`}>
                {item.configured ? 'Configurado' : 'Pendente'}
              </span>
              {item.key === 'firebase' && (
                <span className="badge info">Push Notifications</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
