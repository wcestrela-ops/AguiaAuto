import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';

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
      <PageHeaderWithHelp
        title="Meu Painel"
        subtitle="Bem-vindo à Águia Gestão Veicular."
        guideId="client_home"
        scope="client"
        className="page-header"
      />

      {error && <div className="alert error">{error}</div>}

      {dashboard && (
        <>
          <div className="card-grid">
            <Link to="/app/veiculos" className="card card-link">
              <span className="card-icon">🚗</span>
              <h3>Veículos</h3>
              <p>{dashboard.veiculos_ativos ?? 0} ativos · {dashboard.veiculos_total ?? 0} total</p>
            </Link>
            <Link to="/app/financeiro" className="card card-link">
              <span className="card-icon">💳</span>
              <h3>Financeiro</h3>
              <p>
                {dashboard.situacao_financeira?.status === 'atrasado' ? 'Em atraso' : 'Em dia'}
                {dashboard.situacao_financeira?.proximo_vencimento
                  ? ` · vence ${new Date(dashboard.situacao_financeira.proximo_vencimento).toLocaleDateString('pt-BR')}`
                  : ''}
              </p>
            </Link>
            <Link to="/app/contratos" className="card card-link">
              <span className="card-icon">📄</span>
              <h3>Contratos</h3>
              <p>
                {dashboard.contratos_pendentes > 0
                  ? `${dashboard.contratos_pendentes} pendente(s) de aceite`
                  : 'Contrato e termos de entrega'}
              </p>
            </Link>
            <Link to="/app/frota" className="card card-link">
              <span className="card-icon">🛠️</span>
              <h3>Documentos</h3>
              <p>
                {dashboard.frota?.documentos_vencidos > 0
                  ? `${dashboard.frota.documentos_vencidos} doc. vencido(s)`
                  : dashboard.frota?.manutencoes_proximas > 0
                    ? `${dashboard.frota.manutencoes_proximas} manutenção(ões) próxima(s)`
                    : 'CRLV, seguro e revisões'}
              </p>
            </Link>
            <Link to="/app/emergencia" className="card card-link emergency-home-card">
              <span className="card-icon">🆘</span>
              <h3>Emergência</h3>
              <p>SOS — alerta contatos com localização</p>
            </Link>
            <Link to="/app/alertas" className="card card-link">
              <span className="card-icon">🔔</span>
              <h3>Alertas</h3>
              <p>
                {dashboard.alertas_nao_lidos ?? 0} não lidos
                {dashboard.alertas_recentes?.length ? ` · ${dashboard.alertas_recentes.length} recentes` : ''}
              </p>
            </Link>
            <Link to="/app/perfil" className="card card-link">
              <span className="card-icon">👤</span>
              <h3>Meu Perfil</h3>
              <p>Alterar dados e senha</p>
            </Link>
          </div>

          {dashboard.veiculos?.length > 0 && (
            <section className="dashboard-section">
              <div className="section-header">
                <h2>Meus veículos</h2>
                <Link to="/app/veiculos">Ver todos</Link>
              </div>
              <div className="vehicle-list compact">
                {dashboard.veiculos.slice(0, 3).map((vehicle) => (
                  <Link key={vehicle.id} to={`/app/veiculos/${vehicle.id}`} className="vehicle-card card-link">
                    <div className="vehicle-card-header">
                      <div>
                        <h3>{vehicle.label}</h3>
                        <p className="muted">{vehicle.plate}</p>
                      </div>
                      <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
                        {vehicleStatusLabel(vehicle.status)}
                      </span>
                    </div>
                    {dashboard.veiculos_resumo?.find((r) => r.id === vehicle.id)?.endereco && (
                      <p className="vehicle-card-meta">
                        {dashboard.veiculos_resumo.find((r) => r.id === vehicle.id).endereco}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
