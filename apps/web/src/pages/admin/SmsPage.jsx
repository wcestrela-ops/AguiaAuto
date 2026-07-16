import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import FieldInput from '../../components/FieldInput';

const PROVIDER_LABELS = {
  fake: 'Simulado (dev)',
  android: 'Gateway Android',
  smsmarket: 'SMSMarket',
};

export default function SmsPage() {
  const [data, setData] = useState({ providers: [], primary: null, backup: null });
  const [types, setTypes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'fake', enabled: true, name: 'Gateway SMS' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [providersRes, typesRes, dispatchesRes] = await Promise.all([
        api.getSmsProviders(),
        api.getSmsTypes(),
        api.getSmsDispatches({ limit: 20 }),
      ]);
      setData(providersRes.data);
      setTypes(typesRes.data);
      setDispatches(dispatchesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedType = types.find((t) => t.type === form.provider);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createSmsProvider(form);
      setMessage('Gateway SMS cadastrado.');
      setShowForm(false);
      setForm({ provider: 'fake', enabled: true, name: 'Gateway SMS' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAction(action, id) {
    setError('');
    setMessage('');
    try {
      if (action === 'primary') await api.setSmsPrimary(id);
      if (action === 'backup') await api.setSmsBackup(id);
      if (action === 'test') {
        const res = await api.testSms(id);
        setMessage(res.data?.message || 'Teste OK.');
      }
      if (action === 'delete') {
        if (!confirm('Remover este gateway?')) return;
        await api.deleteSms(id);
        setMessage('Gateway removido.');
      }
      if (action !== 'test') load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Veículos → SMS Rastreador</h1>
          <p>
            Comandos SMS para chips dos rastreadores (failover 4G), alertas e cobrança.
            Mesmo padrão do WhatsApp — gateways no banco Águia, sem sistema separado.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Novo Gateway'}
        </button>
      </header>

      <div className="info-box">
        <strong>Failover SMS:</strong> Principal{' '}
        {data.primary ? PROVIDER_LABELS[data.primary.provider] || data.primary.name : '—'}
        {' · '}Backup{' '}
        {data.backup ? PROVIDER_LABELS[data.backup.provider] || data.backup.name : '—'}
        <br />
        <small>
          O número do chip fica em cada veículo (<code>tracker_phone</code>).
          Importe dados do GPSWOX em Veículos → Sincronizar GPSWOX.
        </small>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <h3>Novo Gateway SMS</h3>

          <label>
            Nome
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Gateway SMS principal"
            />
          </label>

          <label>
            Tipo
            <select value={form.provider} onChange={(e) => updateForm('provider', e.target.value)}>
              {types.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
          </label>

          {selectedType?.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={form[field.key] ?? ''}
              onChange={(v) => updateForm(field.key, v)}
            />
          ))}

          <button type="submit">Cadastrar</button>
        </form>
      )}

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="table-card">
        <h3>Gateways configurados</h3>
        <table>
          <thead>
            <tr>
              <th>Gateway</th>
              <th>Status</th>
              <th>Papel</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.length === 0 && (
              <tr><td colSpan={4} className="muted">Nenhum gateway cadastrado.</td></tr>
            )}
            {data.providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name || PROVIDER_LABELS[p.provider] || p.provider}</strong>
                  <br /><small>{p.base_url || p.device_id || p.sender_id || '—'}</small>
                </td>
                <td>
                  <span className={`badge ${p.status === 'connected' ? 'success' : p.status === 'error' ? 'error' : 'warning'}`}>
                    {p.status || 'unknown'}
                  </span>
                </td>
                <td>
                  {p.is_primary && <span className="badge info">Principal</span>}
                  {p.is_backup && <span className="badge info">Backup</span>}
                </td>
                <td className="actions">
                  {!p.is_primary && (
                    <button type="button" className="btn-sm" onClick={() => handleAction('primary', p.id)}>Principal</button>
                  )}
                  {!p.is_backup && (
                    <button type="button" className="btn-sm" onClick={() => handleAction('backup', p.id)}>Backup</button>
                  )}
                  <button type="button" className="btn-sm" onClick={() => handleAction('test', p.id)}>Testar</button>
                  <button type="button" className="btn-sm btn-danger" onClick={() => handleAction('delete', p.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-card" style={{ marginTop: '1.5rem' }}>
        <h3>Últimos envios SMS</h3>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Telefone</th>
              <th>Ação</th>
              <th>Veículo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.length === 0 && (
              <tr><td colSpan={5} className="muted">Nenhum envio registrado.</td></tr>
            )}
            {dispatches.map((d) => (
              <tr key={d.id}>
                <td><small>{new Date(d.created_at).toLocaleString('pt-BR')}</small></td>
                <td>{d.phone}</td>
                <td>{d.action || d.source}</td>
                <td>{d.vehicle_id || '—'}</td>
                <td><span className="badge">{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
