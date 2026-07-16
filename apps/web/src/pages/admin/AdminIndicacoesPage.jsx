import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { PageHeaderWithHelp } from '../../components/HelpGuide';

export default function AdminIndicacoesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminIndicacoes();
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSync() {
    setSyncing(true);
    setMessage('');
    setError('');
    try {
      const res = await api.syncAdminIndicacoes();
      setMessage(res.message || 'Sincronização concluída.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const stats = data?.estatisticas || {};

  return (
    <div>
      <PageHeaderWithHelp
        title="Indique e Ganhe"
        subtitle="Indicações, qualificação automática e descontos na mensalidade."
        guideId="admin_indicacoes"
      >
        <button type="button" className="btn-secondary" onClick={handleSync} disabled={syncing || loading}>
          {syncing ? 'Sincronizando...' : 'Sincronizar descontos'}
        </button>
      </PageHeaderWithHelp>

      <PageAlerts error={error} message={message} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : (
        <>
          <div className="info-box">{data?.regra}</div>

          <div className="card-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="card"><h3>Total</h3><p>{stats.total || 0}</p></div>
            <div className="card"><h3>Aguardando</h3><p>{stats.aguardando || 0}</p></div>
            <div className="card"><h3>Confirmadas</h3><p>{stats.qualificadas || 0}</p></div>
            <div className="card"><h3>Desconto aplicado</h3><p>{stats.desconto_aplicado || 0}</p></div>
            <div className="card"><h3>Indicadores ativos</h3><p>{stats.indicadores_ativos || 0}</p></div>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Indicado</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th>Qualificada</th>
                </tr>
              </thead>
              <tbody>
                {(data?.indicacoes || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">Nenhuma indicação registrada.</td>
                  </tr>
                ) : (
                  (data?.indicacoes || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.referrer.name || row.referrer.email}</strong>
                        <br /><small>{row.referrer.codigo}</small>
                      </td>
                      <td>
                        {row.referred.name || row.referred.email}
                        <br /><small>{row.referred.email}</small>
                      </td>
                      <td>{row.discount_status_label}</td>
                      <td><small>{row.referred.cadastro_em ? new Date(row.referred.cadastro_em).toLocaleDateString('pt-BR') : '—'}</small></td>
                      <td><small>{row.qualified_at ? new Date(row.qualified_at).toLocaleDateString('pt-BR') : '—'}</small></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
