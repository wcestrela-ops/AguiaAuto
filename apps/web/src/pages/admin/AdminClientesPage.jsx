import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import {
  INACTIVE_ACCESS_DAYS_DEFAULT,
  accessInactiveHint,
  isAccessInactive,
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

const ACCESS_FILTERS = [
  { value: '', label: 'Qualquer último acesso' },
  { value: 'never', label: 'Nunca acessou' },
  { value: '7', label: 'Sem acesso há 7+ dias' },
  { value: '30', label: 'Sem acesso há 30+ dias' },
  { value: '60', label: 'Sem acesso há 60+ dias' },
  { value: '90', label: 'Sem acesso há 90+ dias' },
];

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Cadastro (mais recente)' },
  { value: 'last_access_asc', label: 'Último acesso (mais antigo)' },
  { value: 'last_access_desc', label: 'Último acesso (mais recente)' },
  { value: 'name_asc', label: 'Nome (A–Z)' },
];

const EMPTY_APPLIED = {
  q: '',
  active: '',
  provisioning_status: '',
  access: '',
  sort: 'created_desc',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function buildApiParams(applied, offset) {
  const params = {
    limit: PAGE_SIZE,
    offset,
    sort: applied.sort || 'created_desc',
  };
  if (applied.q) params.q = applied.q;
  if (applied.active) params.active = applied.active;
  if (applied.provisioning_status) params.provisioning_status = applied.provisioning_status;
  if (applied.access === 'never') {
    params.never_accessed = 'true';
  } else if (applied.access) {
    params.access_inactive_days = applied.access;
  }
  return params;
}

function readFiltersFromSearchParams(searchParams) {
  const accessInactiveDays = searchParams.get('access_inactive_days');
  const neverAccessed = searchParams.get('never_accessed') === 'true';
  const sort = searchParams.get('sort');

  if (!accessInactiveDays && !neverAccessed && !sort) {
    return null;
  }

  return {
    ...EMPTY_APPLIED,
    access: neverAccessed ? 'never' : (accessInactiveDays || ''),
    sort: sort || (neverAccessed || accessInactiveDays ? 'last_access_asc' : 'created_desc'),
  };
}

export default function AdminClientesPage() {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftActive, setDraftActive] = useState('');
  const [draftProvisioning, setDraftProvisioning] = useState('');
  const [draftAccess, setDraftAccess] = useState('');
  const [draftSort, setDraftSort] = useState('created_desc');
  const [applied, setApplied] = useState(EMPTY_APPLIED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminClientsSummary()
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fromUrl = readFiltersFromSearchParams(searchParams);
    if (!fromUrl) return;

    setDraftAccess(fromUrl.access);
    setDraftSort(fromUrl.sort);
    setApplied(fromUrl);
    setOffset(0);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.getAdminClientsPanel(buildApiParams(applied, offset));
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
      access: draftAccess,
      sort: draftSort,
    });
  }

  function resetFilters() {
    setDraftQuery('');
    setDraftActive('');
    setDraftProvisioning('');
    setDraftAccess('');
    setDraftSort('created_desc');
    setOffset(0);
    setApplied(EMPTY_APPLIED);
  }

  function applyQuickAccessFilter(access, sort = 'last_access_asc') {
    setDraftAccess(access);
    setDraftSort(sort);
    setOffset(0);
    setApplied((prev) => ({ ...prev, access, sort }));
  }

  const inactiveDays = summary?.inactive_access_days || INACTIVE_ACCESS_DAYS_DEFAULT;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeaderWithHelp
        title="Clientes"
        subtitle="Visão consolidada de cadastro, veículos, financeiro e último acesso ao app"
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
          <Link
            to={`/admin/clientes?access_inactive_days=${inactiveDays}&sort=last_access_asc`}
            className="card card-link client-inactive-card"
            onClick={(event) => {
              event.preventDefault();
              applyQuickAccessFilter(String(inactiveDays));
            }}
          >
            <h3>Sem acesso há {inactiveDays}+ dias</h3>
            <p className="client-summary-value">{summary.inactive_access}</p>
            {summary.never_accessed > 0 && (
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
                {summary.never_accessed} nunca acessou
              </p>
            )}
          </Link>
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
            Status da conta
            <select value={draftActive} onChange={(e) => setDraftActive(e.target.value)}>
              {ACTIVE_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Último acesso
            <select value={draftAccess} onChange={(e) => setDraftAccess(e.target.value)}>
              {ACCESS_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Ordenar por
            <select value={draftSort} onChange={(e) => setDraftSort(e.target.value)}>
              {SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
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
                  <th>Último acesso</th>
                  <th>Cadastro</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={8} className="muted">Nenhum cliente encontrado.</td></tr>
                ) : (
                  clients.map((client) => {
                    const inactiveHint = client.active
                      ? accessInactiveHint(client.last_access_at, inactiveDays)
                      : null;

                    return (
                      <tr
                        key={client.id}
                        className={inactiveHint ? 'client-row-inactive-access' : undefined}
                      >
                        <td>
                          <strong>{client.name || '—'}</strong>
                          <div className="muted audit-actor-id">{client.email}</div>
                          {!client.active && (
                            <span className="badge error" style={{ marginTop: '0.35rem' }}>Conta inativa</span>
                          )}
                          {inactiveHint && (
                            <span className="badge warning" style={{ marginTop: '0.35rem' }}>{inactiveHint}</span>
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
                        <td>
                          <div>{formatDateTime(client.last_access_at)}</div>
                          {client.last_access_ip && (
                            <div className="muted audit-actor-id">{client.last_access_ip}</div>
                          )}
                          {client.active && isAccessInactive(client.last_access_at, 7) && !inactiveHint && (
                            <div className="muted audit-actor-id">7+ dias</div>
                          )}
                        </td>
                        <td>{formatDate(client.created_at)}</td>
                        <td>
                          <Link to={`/admin/clientes/${client.id}`} className="btn-ghost btn-sm">
                            Ver ficha
                          </Link>
                        </td>
                      </tr>
                    );
                  })
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
