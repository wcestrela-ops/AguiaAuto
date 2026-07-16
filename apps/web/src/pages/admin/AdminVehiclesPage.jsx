import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';

const STATUS_OPTIONS = [
  { value: 'pending_installation', label: 'Aguardando instalação' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'blocked', label: 'Bloqueado' },
];

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

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [trackerModels, setTrackerModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [vehiclesRes, usersRes, modelsRes] = await Promise.all([
        api.getAdminVehicles(),
        api.getAdminUsers(),
        api.getTrackerModels(),
      ]);
      setVehicles(vehiclesRes.data || []);
      setUsers(usersRes.data || []);
      setTrackerModels(modelsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      plate: form.plate.trim(),
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
      load();
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
      if (!dryRun) load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Veículos</h1>
          <p>Cadastre veículos, importe do GPSWOX (chip SIM, IMEI, modelo) e vincule ao cliente.</p>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={() => handleSyncGpswox(true)}>
            Prévia GPSWOX
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleSyncGpswox(false)}>
            Sincronizar GPSWOX
          </button>
          <button type="button" onClick={startCreate}>Novo veículo</button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Editar veículo' : 'Novo veículo'}</h3>

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
            Placa <span className="required">*</span>
            <input value={form.plate} onChange={(e) => updateForm('plate', e.target.value)} required />
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
        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Cliente</th>
              <th>Device ID</th>
              <th>Chip SIM</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">Nenhum veículo cadastrado.</td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate}</td>
                  <td>{vehicle.user_name || vehicle.user_email}</td>
                  <td><code>{vehicle.gpswox_device_id || '—'}</code></td>
                  <td>{vehicle.tracker_phone || '—'}</td>
                  <td>
                    <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
                      {vehicleStatusLabel(vehicle.status)}
                    </span>
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
