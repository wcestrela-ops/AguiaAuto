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
                  <p className="muted">{job.plate}</p>
                </div>
                <span className="badge warning">Pendente</span>
              </div>
              <p className="vehicle-card-meta">
                Cliente: {job.client?.name || job.client?.email}
                {job.client?.phone ? ` · ${job.client.phone}` : ''}
              </p>
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
