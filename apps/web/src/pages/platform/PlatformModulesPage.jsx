import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';

export default function PlatformModulesPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlatformModules()
      .then((res) => {
        if (!cancelled) setModules(res.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const grouped = modules.reduce((acc, mod) => {
    const cat = mod.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mod);
    return acc;
  }, {});

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Catálogo de módulos</h1>
          <p className="muted">Módulos globais disponíveis para contratação por empresa.</p>
        </div>
      </header>

      <PageAlerts error={error} />

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading ? Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>{category}</h3>
          <table className="table-card">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Core</th>
                <th>Público</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((mod) => (
                <tr key={mod.code}>
                  <td><code>{mod.code}</code></td>
                  <td>
                    <strong>{mod.name}</strong>
                    {mod.description ? <div className="muted">{mod.description}</div> : null}
                  </td>
                  <td>{mod.is_core ? 'Sim' : '—'}</td>
                  <td>{mod.is_public ? 'Sim' : '—'}</td>
                  <td><span className="badge success">{mod.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )) : null}
    </div>
  );
}
