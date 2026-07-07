import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function InstallerHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInstallerHistory()
      .then((res) => setHistory(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Histórico</h1>
        <p>Instalações realizadas por você.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : history.length === 0 ? (
        <div className="card">
          <p>Nenhuma instalação registrada ainda.</p>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Cliente</th>
                <th>Device ID</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.plate}</td>
                  <td>{item.client_name}</td>
                  <td><code>{item.gpswox_device_id}</code></td>
                  <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
