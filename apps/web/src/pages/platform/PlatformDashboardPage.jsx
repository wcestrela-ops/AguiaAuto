import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';

function statusBadge(status) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  const cls = normalized === 'OK' || normalized === 'HEALTHY' || normalized === 'ACTIVE'
    ? 'success'
    : normalized === 'DEGRADED' || normalized === 'WARNING'
      ? 'warning'
      : 'error';
  return <span className={`badge ${cls}`}>{normalized}</span>;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function PlatformDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlatformHealth()
      .then((res) => {
        if (!cancelled) setData(res.data || res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const health = data?.health || {};
  const queues = data?.queues || [];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Dashboard da plataforma</h1>
          <p className="muted">Saúde operacional da API, filas e workers.</p>
        </div>
        <Link to="/platform/tenants" className="btn-secondary">Ver empresas</Link>
      </header>

      <PageAlerts error={error} />

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading && data ? (
        <>
          <div className="dashboard-cards">
            <div className="card">
              <h3>Status geral</h3>
              <p>{statusBadge(health.status)}</p>
              <small className="muted">Atualizado: {formatDateTime(data.generated_at)}</small>
            </div>
            <div className="card">
              <h3>Banco de dados</h3>
              <p>{statusBadge(health.database?.status || health.db?.status)}</p>
              {health.database?.latency_ms != null ? (
                <small className="muted">{health.database.latency_ms} ms</small>
              ) : null}
            </div>
            <div className="card">
              <h3>Redis</h3>
              <p>{statusBadge(health.redis?.status)}</p>
            </div>
            <div className="card">
              <h3>Filas</h3>
              <p><strong>{queues.length}</strong> fila(s) monitorada(s)</p>
            </div>
          </div>

          {queues.length > 0 ? (
            <section className="card" style={{ marginTop: '1.5rem' }}>
              <h3>Filas BullMQ</h3>
              <table className="table-card">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Aguardando</th>
                    <th>Ativos</th>
                    <th>Concluídos</th>
                    <th>Falhas</th>
                  </tr>
                </thead>
                <tbody>
                  {queues.map((q) => (
                    <tr key={q.name || q.queue}>
                      <td>{q.name || q.queue}</td>
                      <td>{q.waiting ?? q.counts?.waiting ?? '—'}</td>
                      <td>{q.active ?? q.counts?.active ?? '—'}</td>
                      <td>{q.completed ?? q.counts?.completed ?? '—'}</td>
                      <td>{q.failed ?? q.counts?.failed ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {health.checks ? (
            <section className="card" style={{ marginTop: '1.5rem' }}>
              <h3>Verificações</h3>
              <table className="table-card">
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(health.checks).map(([key, check]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{statusBadge(check?.status || check)}</td>
                      <td>{check?.message || check?.detail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
