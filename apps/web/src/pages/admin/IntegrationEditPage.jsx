import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import FieldInput from '../../components/FieldInput';
import PageAlerts from '../../components/PageAlerts';
import { HelpButton, PageHeaderWithHelp } from '../../components/HelpGuide';
import { getIntegrationGuide, INTEGRATION_GUIDE_KEYS } from '../../content/admin-guides';

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

  const guide = getIntegrationGuide(key);
  const guideId = INTEGRATION_GUIDE_KEYS[key];

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

  return (
    <div>
      <Link to="/admin/integracoes" className="back-link">← Integrações</Link>

      <PageHeaderWithHelp
        title={data?.label || 'Integração'}
        subtitle={data?.description || 'Configure credenciais e teste a conexão.'}
        guideId={guideId}
      />

      <PageAlerts error={error} message={message} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : !data ? (
        <div className="alert error">{error || 'Integração não encontrada.'}</div>
      ) : (
        <>
          {guide && (
            <div className="integration-guide-box">
              <HelpButton guideId={guideId} size="sm" />
              <p>
                Clique em <strong>?</strong> para ver o passo a passo completo de configuração.
                {key === 'payment_gateways' && ' Configure Asaas e Mercado Pago antes de definir o failover.'}
                {key === 'sms_gpswox_gateway' && ' Depois copie a URL em SMS Rastreador e cole no painel GPSWOX.'}
              </p>
            </div>
          )}

          <form className="form-card" onSubmit={handleSave}>
            <label className="checkbox-row">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Integração habilitada
            </label>
            <p className="guide-inline">Desmarque para pausar a integração sem apagar as credenciais salvas.</p>

            {(data.fields || []).map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={settings[field.key] ?? ''}
                onChange={(v) => updateField(field.key, v)}
              />
            ))}

            <div className="form-actions">
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="btn-secondary" onClick={handleTest} disabled={testing}>
                {testing ? 'Testando...' : 'Testar conexão'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
