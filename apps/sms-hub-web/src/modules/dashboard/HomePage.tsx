import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';

export default function HomePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const user = api.getUser();

  useEffect(() => {
    api.dashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Início</h1>
        <p>Olá, {user?.name}. Painel operacional AG SMS Hub.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="stat-grid">
        {Object.entries(data || {}).filter(([key]) => !['role', 'company_id'].includes(key)).map(([key, value]) => (
          <div key={key} className="stat-card">
            <strong>{String(value)}</strong>
            <span>{key.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Próximos passos</h3>
        <p style={{ color: 'var(--muted)' }}>
          Biblioteca, dispositivos, envio e gateways serão habilitados nas próximas entregas.
        </p>
        <Link to="/send" className="btn" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          Enviar comando
        </Link>
      </div>
    </div>
  );
}
