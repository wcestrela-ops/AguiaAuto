import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';
import ExportButtons from '../../components/ExportButtons';
import { HelpButton, PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const STATUS_OPTIONS = [
  { value: 'pending_installation', label: 'Aguardando instalação' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'blocked', label: 'Bloqueado' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Todos os status' },
  ...STATUS_OPTIONS,
];

const ISSUE_FILTERS = [
  { value: '', label: 'Qualquer pendência' },
  { value: 'missing_device', label: 'Sem Device ID GPSWOX' },
  { value: 'missing_chip', label: 'Sem chip SIM (ativos/bloqueados)' },
  { value: 'missing_imei', label: 'Sem IMEI (ativos/bloqueados)' },
  { value: 'missing_model', label: 'Sem modelo rastreador (ativos/bloqueados)' },
];

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Cadastro (mais recente)' },
  { value: 'created_asc', label: 'Cadastro (mais antigo)' },
  { value: 'plate_asc', label: 'Placa (A–Z)' },
  { value: 'client_asc', label: 'Cliente (A–Z)' },
  { value: 'status_asc', label: 'Status' },
];

const EMPTY_FILTERS = {
  q: '',
  status: '',
  user_id: '',
  issue: '',
  sort: 'created_desc',
};

const EMPTY_FORM = {
  user_id: '',
  plate: '',
  brand: '',
  model: '',
  color: '',
  year: '',
  gpswox_device_id: '',
  gpswox_name: '',
  tracker_phone: '',
  tracker_model: '',
  tracker_model_id: '',
  tracker_imei: '',
  status: 'pending_installation',
};

function buildApiParams(applied) {
  const params = { sort: applied.sort || 'created_desc' };
  if (applied.q) params.q = applied.q;
  if (applied.status) params.status = applied.status;
  if (applied.user_id) params.user_id = applied.user_id;
  if (applied.issue) params.issue = applied.issue;
  return params;
}

function readFiltersFromSearchParams(searchParams) {
  const issue = searchParams.get('issue');
  const status = searchParams.get('status');
  if (!issue && !status) return null;
  return {
    ...EMPTY_FILTERS,
    issue: issue || '',
    status: status || '',
  };
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InstallerAssignmentCell({ vehicle, installers, onChange, onError }) {
  const [installerId, setInstallerId] = useState(
    vehicle.assigned_installer_id ? String(vehicle.assigned_installer_id) : '',
  );
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(vehicle.installation_scheduled_at));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInstallerId(vehicle.assigned_installer_id ? String(vehicle.assigned_installer_id) : '');
    setScheduledAt(toDatetimeLocalValue(vehicle.installation_scheduled_at));
  }, [vehicle.assigned_installer_id, vehicle.installation_scheduled_at]);

  async function handleAssign() {
    if (!installerId) {
      onError('Selecione um instalador para atribuir.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      await api.assignVehicleInstaller(vehicle.id, {
        installer_id: Number(installerId),
        installation_scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      await onChange();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign() {
    setSaving(true);
    onError('');
    try {
      await api.unassignVehicleInstaller(vehicle.id);
      setInstallerId('');
      setScheduledAt('');
      await onChange();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="installer-assignment-cell">
      <select
        value={installerId}
        onChange={(e) => setInstallerId(e.target.value)}
        disabled={saving}
      >
        <option value="">Pool (qualquer instalador)</option>
        {installers.map((installer) => (
          <option key={installer.id} value={installer.id}>
            {installer.name || installer.email}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        disabled={saving}
        title="Agendamento opcional"
      />
      <div className="table-actions">
        <button type="button" className="btn-sm" onClick={handleAssign} disabled={saving || !installerId}>
          {saving ? '...' : 'Atribuir'}
        </button>
        {vehicle.assigned_installer_id ? (
          <button type="button" className="btn-sm btn-secondary" onClick={handleUnassign} disabled={saving}>
            Remover
          </button>
        ) : null}
      </div>
      {vehicle.assigned_installer_name && (
        <small className="muted">
          Atual: {vehicle.assigned_installer_name}
          {vehicle.installation_scheduled_at
            ? ` · ${new Date(vehicle.installation_scheduled_at).toLocaleString('pt-BR')}`
            : ''}
        </small>
      )}
    </div>
  );
}

export default function AdminVehiclesPage() {
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [trackerModels, setTrackerModels] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const [draftIssue, setDraftIssue] = useState('');
  const [draftSort, setDraftSort] = useState('created_desc');
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const loadVehicles = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const res = await api.getAdminVehicles(buildApiParams(applied));
      setVehicles(res.data?.vehicles || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setListLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      try {
        const [usersRes, installersRes, modelsRes, syncRes] = await Promise.all([
          api.getAdminUsers(),
          api.getAdminInstallers(),
          api.getTrackerModels(),
          api.getGpswoxSyncStatus().catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setUsers(usersRes.data || []);
        setInstallers(installersRes.data || []);
        setTrackerModels(modelsRes.data || []);
        setSyncStatus(syncRes.data || null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const fromUrl = readFiltersFromSearchParams(searchParams);
    if (!fromUrl) return;

    setDraftIssue(fromUrl.issue);
    setDraftStatus(fromUrl.status);
    setApplied(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setApplied({
      q: draftQuery.trim(),
      status: draftStatus,
      user_id: draftUserId,
      issue: draftIssue,
      sort: draftSort,
    });
  }

  function resetFilters() {
    setDraftQuery('');
    setDraftStatus('');
    setDraftUserId('');
    setDraftIssue('');
    setDraftSort('created_desc');
    setApplied(EMPTY_FILTERS);
  }

  function applyQuickIssue(issue) {
    setDraftIssue(issue);
    setApplied((prev) => ({ ...prev, issue }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(vehicle) {
    setEditingId(vehicle.id);
    setForm({
      user_id: String(vehicle.user_id || ''),
      plate: vehicle.plate || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      color: vehicle.color || '',
      year: vehicle.year ? String(vehicle.year) : '',
      gpswox_device_id: vehicle.gpswox_device_id || '',
      gpswox_name: vehicle.gpswox_name || '',
      tracker_phone: vehicle.tracker_phone || '',
      tracker_model: vehicle.tracker_model || '',
      tracker_model_id: vehicle.tracker_model_id ? String(vehicle.tracker_model_id) : '',
      tracker_imei: vehicle.tracker_imei || '',
      status: vehicle.status || 'pending_installation',
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const payload = {
      plate: form.plate.trim() || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      color: form.color.trim() || null,
      year: form.year ? Number(form.year) : null,
      gpswox_device_id: form.gpswox_device_id.trim() || null,
      gpswox_name: form.gpswox_name.trim() || null,
      tracker_phone: form.tracker_phone.trim() || null,
      tracker_model: form.tracker_model.trim() || null,
      tracker_model_id: form.tracker_model_id ? Number(form.tracker_model_id) : null,
      tracker_imei: form.tracker_imei.trim() || null,
      status: form.status,
    };

    try {
      if (editingId) {
        await api.updateAdminVehicle(editingId, payload);
        setMessage('Veículo atualizado.');
      } else {
        await api.createAdminVehicle({
          ...payload,
          user_id: Number(form.user_id),
        });
        setMessage('Veículo cadastrado.');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadVehicles();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSyncGpswox(dryRun = false) {
    setError('');
    setMessage('');
    try {
      const res = await api.syncGpswoxVehicles({ dry_run: dryRun });
      const s = res.data;
      setMessage(
        dryRun
          ? `Prévia: ${s.total} dispositivos GPSWOX (${s.preview?.length || 0} na amostra).`
          : `Sincronizado: ${s.created} criados, ${s.updated} atualizados, ${s.skipped} ignorados.`,
      );
      if (!dryRun) await loadVehicles();
    } catch (err) {
      setError(err.message);
    }
  }

  if (metaLoading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <PageHeaderWithHelp
        title="Veículos"
        subtitle="Cadastre veículos, importe do GPSWOX (chip SIM, IMEI, modelo) e vincule ao cliente."
        guideId="vehicles"
      >
        <div className="row" style={{ gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={() => handleSyncGpswox(true)}>
            Prévia GPSWOX
          </button>
          <HelpButton guideId="vehicles_sync" size="sm" label="Ajuda: sincronizar GPSWOX" />
          <button type="button" className="btn-secondary" onClick={() => handleSyncGpswox(false)}>
            Sincronizar GPSWOX
          </button>
          <button type="button" onClick={startCreate}>Novo veículo</button>
        </div>
      </PageHeaderWithHelp>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {syncStatus && (
        <div className="form-card" style={{ marginBottom: '1rem' }}>
          <SectionTitleWithHelp title="Sync GPSWOX automático" guideId="vehicles_sync" />
          <div className="row" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge ${syncStatus.auto_sync_enabled ? 'success' : 'warning'}`}>
              {syncStatus.auto_sync_enabled ? 'Ativo' : 'Desligado'}
            </span>
            {syncStatus.in_progress && <span className="badge info">Sincronizando...</span>}
            <span className="guide-inline" style={{ margin: 0 }}>
              Intervalo: {syncStatus.interval_hours}h
              {syncStatus.next_due_at && (
                <> · Próximo: {new Date(syncStatus.next_due_at).toLocaleString('pt-BR')}</>
              )}
            </span>
          </div>
          {syncStatus.last_success && (
            <p className="guide-inline">
              Último sync: {new Date(syncStatus.last_success.finished_at).toLocaleString('pt-BR')}
              {' '}— {syncStatus.last_success.created} criados, {syncStatus.last_success.updated} atualizados
              {syncStatus.unlinked_devices_last_success > 0 && (
                <>, <strong>{syncStatus.unlinked_devices_last_success} sem cliente Águia</strong></>
              )}
            </p>
          )}
          {!syncStatus.auto_sync_enabled && (
            <p className="guide-inline">
              Ative em <Link to="/admin/integracoes/gpswox">Integrações → GPSWOX</Link> (Sync automático de veículos).
            </p>
          )}
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
              placeholder="Placa, cliente, Device ID, IMEI, chip..."
            />
          </label>

          <label>
            Status
            <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
              {STATUS_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Cliente
            <select value={draftUserId} onChange={(e) => setDraftUserId(e.target.value)}>
              <option value="">Todos os clientes</option>
              {users.filter((user) => user.role === 'client').map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            Pendência
            <select value={draftIssue} onChange={(e) => setDraftIssue(e.target.value)}>
              {ISSUE_FILTERS.map((item) => (
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
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit">Filtrar</button>
          <button type="button" className="btn-secondary" onClick={resetFilters}>Limpar</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => applyQuickIssue('missing_device')}>
            Sem Device ID
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => applyQuickIssue('missing_chip')}>
            Sem chip
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => applyQuickIssue('missing_imei')}>
            Sem IMEI
          </button>
        </div>
      </form>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <SectionTitleWithHelp
            title={editingId ? 'Editar veículo' : 'Novo veículo / rastreador'}
            guideId="vehicles"
          />
          <p className="guide-inline">
            Preencha GPSWOX Device ID, chip SIM e modelo da biblioteca para comandos e failover 4G→SMS.
          </p>

          {!editingId && (
            <label>
              Cliente <span className="required">*</span>
              <select
                value={form.user_id}
                onChange={(e) => updateForm('user_id', e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.email})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Placa
            <input value={form.plate} onChange={(e) => updateForm('plate', e.target.value.toUpperCase())} placeholder="Opcional — veículo novo sem emplacamento" />
          </label>
          <label>
            Marca
            <input value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} />
          </label>
          <label>
            Modelo
            <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} />
          </label>
          <label>
            Cor
            <input value={form.color} onChange={(e) => updateForm('color', e.target.value)} />
          </label>
          <label>
            Ano
            <input type="number" value={form.year} onChange={(e) => updateForm('year', e.target.value)} />
          </label>
          <label>
            GPSWOX Device ID
            <input value={form.gpswox_device_id} onChange={(e) => updateForm('gpswox_device_id', e.target.value)} />
            <small className="hint">ID do dispositivo no GPSWOX</small>
          </label>
          <label>
            GPSWOX Nome
            <input value={form.gpswox_name} onChange={(e) => updateForm('gpswox_name', e.target.value)} />
            <small className="hint">Nome do veículo no GPSWOX (fallback Playwright)</small>
          </label>
          <label>
            Número do chip SIM (SMS)
            <input
              value={form.tracker_phone}
              onChange={(e) => updateForm('tracker_phone', e.target.value)}
              placeholder="5511999999999"
            />
            <small className="hint">Comandos SMS e failover 4G usam este número.</small>
          </label>
          <label>
            Modelo do rastreador (biblioteca SMS)
            <select
              value={form.tracker_model_id}
              onChange={(e) => {
                const id = e.target.value;
                const selected = trackerModels.find((m) => String(m.id) === id);
                updateForm('tracker_model_id', id);
                if (selected) updateForm('tracker_model', selected.name);
              }}
            >
              <option value="">Padrão do sistema (GT06)</option>
              {trackerModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.protocol ? ` (${m.protocol})` : ''}</option>
              ))}
            </select>
            <small className="hint">Define quais comandos SMS serão usados no failover 4G.</small>
          </label>
          <label>
            Modelo (texto livre / GPSWOX)
            <input value={form.tracker_model} onChange={(e) => updateForm('tracker_model', e.target.value)} />
          </label>
          <label>
            IMEI do rastreador
            <input value={form.tracker_imei} onChange={(e) => updateForm('tracker_imei', e.target.value)} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="table-card">
        <div className="section-header">
          <h3>Veículos e dispositivos</h3>
          <ExportButtons resource="veiculos" params={buildApiParams(applied)} disabled={listLoading} />
        </div>

        <div className="audit-table-meta">
          <span>{total} veículo(s)</span>
          {listLoading && <span>Atualizando...</span>}
        </div>

        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Cliente</th>
              <th>Device ID</th>
              <th>Chip SIM</th>
              <th>IMEI</th>
              <th>Status</th>
              <th>Instalador</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {!listLoading && vehicles.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">Nenhum veículo encontrado.</td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate || 'Sem placa'}</td>
                  <td>
                    {vehicle.user_name || vehicle.user_email}
                    {vehicle.user_id ? (
                      <div>
                        <Link to={`/admin/clientes/${vehicle.user_id}`} className="btn-ghost btn-sm">Ficha</Link>
                      </div>
                    ) : null}
                  </td>
                  <td><code>{vehicle.gpswox_device_id || '—'}</code></td>
                  <td>{vehicle.tracker_phone || '—'}</td>
                  <td><small>{vehicle.tracker_imei || '—'}</small></td>
                  <td>
                    <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
                      {vehicleStatusLabel(vehicle.status)}
                    </span>
                  </td>
                  <td>
                    {vehicle.status === 'pending_installation' ? (
                      <InstallerAssignmentCell
                        vehicle={vehicle}
                        installers={installers}
                        onChange={loadVehicles}
                        onError={setError}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn-sm btn-secondary" onClick={() => startEdit(vehicle)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
