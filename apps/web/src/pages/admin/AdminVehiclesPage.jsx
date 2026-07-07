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
  status: 'pending_installation',
};

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [vehiclesRes, usersRes] = await Promise.all([
        api.getAdminVehicles(),
        api.getAdminUsers(),
      ]);
      setVehicles(vehiclesRes.data || []);
      setUsers(usersRes.data || []);
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

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Veículos</h1>
          <p>Cadastre veículos e vincule ao GPSWOX e ao cliente.</p>
        </div>
        <button type="button" onClick={startCreate}>Novo veículo</button>
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
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">Nenhum veículo cadastrado.</td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate}</td>
                  <td>{vehicle.user_name || vehicle.user_email}</td>
                  <td><code>{vehicle.gpswox_device_id || '—'}</code></td>
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
