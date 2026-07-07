import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import FieldInput from '../../components/FieldInput';

export default function IntegrationEditPage() {
  const { key } = useParams();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({});
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getIntegration(key)
      .then((res) => {
        setData(res.data);
        setSettings(res.data.settings || {});
        setEnabled(res.data.enabled ?? true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [key]);

  function updateField(fieldKey, value) {
    setSettings((prev) => ({ ...prev, [fieldKey]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await api.saveIntegration(key, settings, enabled);
      setMessage('Configuração salva com sucesso.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage('');
    setError('');

    try {
      const res = await api.testIntegration(key);
      setMessage(res.data?.message || res.message || 'Conexão OK.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (!data) return <div className="alert error">{error || 'Integração não encontrada.'}</div>;

  return (
    <div>
      <header className="page-header">
        <Link to="/admin/integracoes" className="back-link">← Integrações</Link>
        <h1>{data.label}</h1>
        <p>{data.description}</p>
      </header>

      {key === 'firebase' && (
        <div className="info-box">
          Configure aqui todas as credenciais do Firebase para notificações push no PWA e apps.
          O Service Account (client_email + private_key) é usado no servidor. As chaves Web
          (web_api_key, messaging_sender_id, app_id, vapid_key) são usadas no cliente.
        </div>
      )}

      <form className="form-card" onSubmit={handleSave}>
        <label className="checkbox-row">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Integração habilitada
        </label>

        {data.fields?.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={settings[field.key] ?? ''}
            onChange={(v) => updateField(field.key, v)}
          />
        ))}

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testando...' : 'Testar Conexão'}
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
