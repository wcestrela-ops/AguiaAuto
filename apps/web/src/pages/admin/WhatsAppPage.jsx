import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import FieldInput from '../../components/FieldInput';
import PageAlerts from '../../components/PageAlerts';
import { HelpButton, PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const PROVIDER_LABELS = {
  evolution: 'Evolution API',
  waha: 'WAHA',
  meta_cloud: 'Meta Cloud API',
};

const PROVIDER_GUIDES = {
  evolution: 'whatsapp_evolution',
  waha: 'whatsapp_waha',
  meta_cloud: 'whatsapp_meta',
};

export default function WhatsAppPage() {
  const [data, setData] = useState({ providers: [], primary: null, backup: null });
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'evolution', enabled: true });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [providersRes, typesRes] = await Promise.all([
        api.getWhatsAppProviders(),
        api.getWhatsAppTypes(),
      ]);
      setData(providersRes.data);
      setTypes(typesRes.data);
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
      await api.createWhatsAppProvider(form);
      setMessage('Provedor cadastrado.');
      setShowForm(false);
      setForm({ provider: 'evolution', enabled: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAction(action, id) {
    setError('');
    setMessage('');
    try {
      if (action === 'primary') await api.setWhatsAppPrimary(id);
      if (action === 'backup') await api.setWhatsAppBackup(id);
      if (action === 'test') {
        const res = await api.testWhatsApp(id);
        setMessage(res.data?.message || 'Teste OK.');
      }
      if (action === 'delete') {
        if (!confirm('Remover este provedor?')) return;
        await api.deleteWhatsApp(id);
        setMessage('Provedor removido.');
      }
      if (action !== 'test') load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeaderWithHelp
        title="WhatsApp"
        subtitle="Multi-provedor com failover automático (principal → backup)."
        guideId="whatsapp"
      >
        <button type="button" onClick={() => setShowForm(!showForm)} disabled={loading}>
          {showForm ? 'Cancelar' : '+ Novo Provedor'}
        </button>
      </PageHeaderWithHelp>

      <PageAlerts error={error} message={message} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : (
        <>
      <div className="info-box">
        <strong>Failover:</strong> Principal{' '}
        {data.primary ? PROVIDER_LABELS[data.primary.provider] || data.primary.provider : '—'}
        {' · '}Backup{' '}
        {data.backup ? PROVIDER_LABELS[data.backup.provider] || data.backup.provider : '—'}
        <p className="guide-inline" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          WhatsApp é usado em cadastro, cobrança e promoções — não em alertas de veículo (anti-ban).
        </p>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <SectionTitleWithHelp title="Novo Provedor WhatsApp" guideId="whatsapp" />

          <label>
            Tipo de provedor
            <select value={form.provider} onChange={(e) => updateForm('provider', e.target.value)}>
              {types.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
            {PROVIDER_GUIDES[form.provider] && (
              <span style={{ display: 'inline-flex', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                <HelpButton guideId={PROVIDER_GUIDES[form.provider]} size="sm" label="Ajuda deste provedor" />
              </span>
            )}
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


      <div className="table-card">
        <div style={{ padding: '1rem 1rem 0' }}>
          <SectionTitleWithHelp title="Provedores configurados" guideId="whatsapp" />
        </div>
        <table>
          <thead>
            <tr>
              <th>Provedor</th>
              <th>Status</th>
              <th>Papel</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.length === 0 && (
              <tr><td colSpan={4} className="muted">Nenhum provedor cadastrado.</td></tr>
            )}
            {data.providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{PROVIDER_LABELS[p.provider] || p.provider}</strong>
                  <br /><small>{p.base_url || p.instance || p.session || p.phone_number_id || '—'}</small>
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
        </>
      )}
    </div>
  );
}
