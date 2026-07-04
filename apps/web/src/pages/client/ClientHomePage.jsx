import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function ClientHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard()
      .then((res) => setDashboard(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Meu Painel</h1>
        <p>Bem-vindo à Águia Gestão Veicular.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      {dashboard && (
        <div className="card-grid">
          <div className="card">
            <span className="card-icon">🚗</span>
            <h3>Veículos</h3>
            <p>{dashboard.veiculos_ativos ?? 0} ativos</p>
          </div>
          <div className="card">
            <span className="card-icon">🔔</span>
            <h3>Alertas</h3>
            <p>{dashboard.alertas_recentes?.length ?? 0} recentes</p>
          </div>
          <Link to="/app/perfil" className="card card-link">
            <span className="card-icon">👤</span>
            <h3>Meu Perfil</h3>
            <p>Alterar dados e senha</p>
          </Link>
        </div>
      )}
    </div>
  );
}
