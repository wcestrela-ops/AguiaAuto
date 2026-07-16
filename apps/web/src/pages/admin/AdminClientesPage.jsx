import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import {
  financialStatusBadge,
  financialStatusLabel,
  provisioningStatusBadge,
  provisioningStatusLabel,
} from '../../utils/clients';

const PAGE_SIZE = 50;

const PROVISIONING_FILTERS = [
  { value: '', label: 'Todos os provisionamentos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluído' },
  { value: 'partial', label: 'Parcial' },
  { value: 'failed', label: 'Falhou' },
];

const ACTIVE_FILTERS = [
  { value: '', label: 'Ativos e inativos' },
  { value: 'true', label: 'Somente ativos' },
  { value: 'false', label: 'Somente inativos' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function AdminClientesPage() {
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftActive, setDraftActive] = useState('');
  const [draftProvisioning, setDraftProvisioning] = useState('');
  const [applied, setApplied] = useState({ q: '', active: '', provisioning_status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminClientsSummary()
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = { limit: PAGE_SIZE, offset };
        if (applied.q) params.q = applied.q;
        if (applied.active) params.active = applied.active;
        if (applied.provisioning_status) params.provisioning_status = applied.provisioning_status;

        const res = await api.getAdminClientsPanel(params);
        if (cancelled) return;
        setClients(res.data?.clients || []);
        setTotal(res.data?.total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [offset, applied]);

  function applyFilters(event) {
    event.preventDefault();
    setOffset(0);
    setApplied({
      q: draftQuery.trim(),
      active: draftActive,
      provisioning_status: draftProvisioning,
    });
  }

  function resetFilters() {
    setDraftQuery('');
    setDraftActive('');
    setDraftProvisioning('');
    setOffset(0);
    setApplied({ q: '', active: '', provisioning_status: '' });
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeaderWithHelp
        title="Clientes"
        subtitle="Visão consolidada de cadastro, veículos, financeiro e provisionamento"
        guideId="admin_clientes"
      />

      {error && <div className="alert error">{error}</div>}

      {summary && (
        <div className="card-grid client-summary-grid">
          <div className="card">
            <h3>Total</h3>
            <p className="client-summary-value">{summary.total}</p>
          </div>
          <div className="card">
            <h3>Ativos</h3>
            <p className="client-summary-value">{summary.active}</p>
          </div>
          <div className="card">
            <h3>Provisionamento pendente</h3>
            <p className="client-summary-value">{summary.provisioning_pending}</p>
          </div>
          <div className="card">
            <h3>Com faturas em aberto</h3>
            <p className="client-summary-value">{summary.with_open_invoices}</p>
          </div>
        </div>
      )}

      <form className="form-card" onSubmit={applyFilters}>
        <div className="form-row">
          <label>
            Buscar
            <input
              type="search"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Nome, e-mail, telefone ou CPF/CNPJ"
            />
          </label>

          <label>
            Status
            <select value={draftActive} onChange={(e) => setDraftActive(e.target.value)}>
              {ACTIVE_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Provisionamento
            <select value={draftProvisioning} onChange={(e) => setDraftProvisioning(e.target.value)}>
              {PROVISIONING_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="submit">Filtrar</button>
          <button type="button" className="btn-secondary" onClick={resetFilters}>Limpar</button>
        </div>
      </form>

      <div className="table-card">
        {loading ? (
          <p className="muted" style={{ padding: '1rem' }}>Carregando...</p>
        ) : (
          <>
            <div className="audit-table-meta">
              <span>{total} cliente(s)</span>
              <span>Página {page} de {totalPages}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Veículos</th>
                  <th>Faturas abertas</th>
                  <th>Provisionamento</th>
                  <th>Cadastro</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={7} className="muted">Nenhum cliente encontrado.</td></tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <strong>{client.name || '—'}</strong>
                        <div className="muted audit-actor-id">{client.email}</div>
                        {!client.active && (
                          <span className="badge error" style={{ marginTop: '0.35rem' }}>Inativo</span>
                        )}
                      </td>
                      <td>
                        <div>{client.phone || '—'}</div>
                        <div className="muted audit-actor-id">{client.cpf_cnpj || '—'}</div>
                      </td>
                      <td>
                        {client.vehicles_active || 0} ativo(s)
                        <div className="muted audit-actor-id">{client.vehicles_count || 0} total</div>
                      </td>
                      <td>
                        {client.open_invoices > 0 ? (
                          <span className="badge warning">{client.open_invoices}</span>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${provisioningStatusBadge(client.provisioning_status)}`}>
                          {provisioningStatusLabel(client.provisioning_status)}
                        </span>
                      </td>
                      <td>{formatDate(client.created_at)}</td>
                      <td>
                        <Link to={`/admin/clientes/${client.id}`} className="btn-ghost btn-sm">
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="audit-pagination">
              <button type="button" className="btn-secondary" disabled={offset <= 0} onClick={() => setOffset(offset - PAGE_SIZE)}>
                Anterior
              </button>
              <button type="button" className="btn-secondary" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
