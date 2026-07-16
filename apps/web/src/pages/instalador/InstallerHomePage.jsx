import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';

export default function InstallerHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInstallerDashboard()
      .then((res) => setDashboard(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <PageHeaderWithHelp
        title="Painel do Instalador"
        subtitle="Instalações pendentes e histórico recente."
        guideId="installer_home"
        scope="installer"
        className="page-header"
      />

      {error && <div className="alert error">{error}</div>}

      {dashboard && (
        <>
          <div className="card-grid">
            <Link to="/instalador/agendamentos" className="card card-link">
              <span className="card-icon">📋</span>
              <h3>Pendentes</h3>
              <p>{dashboard.pendentes ?? 0} aguardando instalação</p>
            </Link>
            <div className="card">
              <span className="card-icon">✅</span>
              <h3>Recentes</h3>
              <p>{dashboard.concluidas_recentes ?? 0} nas últimas instalações</p>
            </div>
          </div>

          {dashboard.ultimas_instalacoes?.length > 0 && (
            <section className="dashboard-section">
              <div className="section-header">
                <h2>Últimas instalações</h2>
                <Link to="/instalador/historico">Ver histórico</Link>
              </div>
              <div className="vehicle-list compact">
                {dashboard.ultimas_instalacoes.map((item) => (
                  <div key={item.id} className="vehicle-card">
                    <div className="vehicle-card-header">
                      <div>
                        <h3>{item.plate}</h3>
                        <p className="muted">{item.client_name}</p>
                      </div>
                      <span className="badge success">Concluída</span>
                    </div>
                    <p className="vehicle-card-meta">
                      Device: {item.gpswox_device_id} ·{' '}
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
