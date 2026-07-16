import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';

export default function InstallerPendingPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInstallerPending()
      .then((res) => setJobs(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeaderWithHelp
        title="Agendamentos"
        subtitle="Veículos aguardando instalação do rastreador."
        guideId="installer_pending"
        scope="installer"
        className="page-header"
      />

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : jobs.length === 0 ? (
        <div className="card">
          <p>Nenhuma instalação pendente no momento.</p>
        </div>
      ) : (
        <div className="vehicle-list">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/instalador/instalacoes/${job.id}`}
              className="vehicle-card card-link"
            >
              <div className="vehicle-card-header">
                <div>
                  <h3>{job.label}</h3>
                  <p className="muted">{job.plate || 'Sem placa'}</p>
                </div>
                <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {job.is_pool ? (
                    <span className="badge info">Pool</span>
                  ) : job.assigned_to_me ? (
                    <span className="badge success">Atribuída a você</span>
                  ) : (
                    <span className="badge">Outro instalador</span>
                  )}
                  <span className="badge warning">Pendente</span>
                </div>
              </div>
              <p className="vehicle-card-meta">
                Cliente: {job.client?.name || job.client?.email}
                {job.client?.phone ? ` · ${job.client.phone}` : ''}
              </p>
              {job.installation_scheduled_at && (
                <p className="vehicle-card-meta">
                  Agendamento: {new Date(job.installation_scheduled_at).toLocaleString('pt-BR')}
                </p>
              )}
              {!job.is_pool && job.assigned_installer_name && !job.assigned_to_me && (
                <p className="vehicle-card-meta muted">
                  Instalador: {job.assigned_installer_name}
                </p>
              )}
              <p className="vehicle-card-meta muted">
                Cadastro: {new Date(job.created_at).toLocaleString('pt-BR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
