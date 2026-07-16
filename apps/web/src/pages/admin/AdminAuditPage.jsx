import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import {
  auditActionLabel,
  auditActorLabel,
  auditResourceLabel,
  formatAuditMetadata,
} from '../../utils/audit';

const PAGE_SIZE = 50;

const ACTOR_TYPES = [
  { value: '', label: 'Todos os atores' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Cliente' },
  { value: 'system', label: 'Sistema' },
];

const RESOURCE_TYPES = [
  { value: '', label: 'Todos os recursos' },
  { value: 'vehicle', label: 'Veículo' },
];

const EMPTY_FILTERS = {
  action: '',
  actor_type: '',
  resource_type: '',
  actor_id: '',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminAuditActions()
      .then((res) => setActions(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = {
          limit: PAGE_SIZE,
          offset,
        };
        if (appliedFilters.action) params.action = appliedFilters.action;
        if (appliedFilters.actor_type) params.actor_type = appliedFilters.actor_type;
        if (appliedFilters.resource_type) params.resource_type = appliedFilters.resource_type;
        if (appliedFilters.actor_id.trim()) params.actor_id = appliedFilters.actor_id.trim();

        const res = await api.getAdminAuditLogs(params);
        if (cancelled) return;
        setLogs(res.data?.logs || []);
        setTotal(res.data?.total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [offset, appliedFilters]);

  function applyFilters(event) {
    event.preventDefault();
    setExpandedId(null);
    setOffset(0);
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setExpandedId(null);
    setOffset(0);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div>
      <PageHeaderWithHelp
        title="Auditoria"
        subtitle="Registro de ações administrativas, comandos de veículo e sync GPSWOX"
        guideId="admin_audit"
      />

      {error && <div className="alert error">{error}</div>}

      <form className="form-card" onSubmit={applyFilters}>
        <div className="form-row">
          <label>
            Ação
            <select
              value={draftFilters.action}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <option value="">Todas as ações</option>
              {actions.map((action) => (
                <option key={action} value={action}>{auditActionLabel(action)}</option>
              ))}
            </select>
          </label>

          <label>
            Ator
            <select
              value={draftFilters.actor_type}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, actor_type: e.target.value }))}
            >
              {ACTOR_TYPES.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Recurso
            <select
              value={draftFilters.resource_type}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, resource_type: e.target.value }))}
            >
              {RESOURCE_TYPES.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            ID do ator
            <input
              type="text"
              value={draftFilters.actor_id}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, actor_id: e.target.value }))}
              placeholder="admin, e-mail ou ID cliente"
            />
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
              <span>{total} registro(s)</span>
              <span>Página {page} de {totalPages}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ator</th>
                  <th>Ação</th>
                  <th>Recurso</th>
                  <th>Resumo</th>
                  <th>IP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="muted">Nenhum registro encontrado.</td></tr>
                ) : (
                  logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr>
                        <td>{formatDate(log.created_at)}</td>
                        <td>
                          <span className={`badge ${log.actor_type === 'admin' ? 'info' : log.actor_type === 'user' ? 'success' : 'warning'}`}>
                            {auditActorLabel(log.actor_type)}
                          </span>
                          <div className="muted audit-actor-id">{log.actor_id || '—'}</div>
                        </td>
                        <td>{auditActionLabel(log.action)}</td>
                        <td>
                          {auditResourceLabel(log.resource_type)}
                          {log.resource_id ? (
                            <div className="muted audit-actor-id">#{log.resource_id}</div>
                          ) : null}
                        </td>
                        <td>{formatAuditMetadata(log.metadata)}</td>
                        <td>{log.ip_address || '—'}</td>
                        <td>
                          {log.metadata ? (
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                              {expandedId === log.id ? 'Ocultar' : 'JSON'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="audit-meta-row">
                          <td colSpan={7}>
                            <pre className="audit-json">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>

            <div className="audit-pagination">
              <button type="button" className="btn-secondary" disabled={!canPrev} onClick={() => setOffset(offset - PAGE_SIZE)}>
                Anterior
              </button>
              <button type="button" className="btn-secondary" disabled={!canNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
