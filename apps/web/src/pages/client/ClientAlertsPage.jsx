import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import { ALERT_TYPE_LABELS, CHANNEL_LABELS } from '../../utils/alerts';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function ClientAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [types, setTypes] = useState({ tipos: [], canais: [] });
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [alertsRes, prefsRes, typesRes] = await Promise.all([
        api.getAlerts(),
        api.getAlertPreferences(),
        api.getAlertTypes(),
      ]);
      setAlerts(alertsRes.data || []);
      setPreferences(prefsRes.data || []);
      setTypes(typesRes.data || { tipos: [], canais: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api.markAlertRead(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllRead() {
    try {
      await api.markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setMessage('Todos os alertas marcados como lidos.');
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleEnabled(prefIndex) {
    setPreferences((prev) => prev.map((p, i) => (
      i === prefIndex ? { ...p, enabled: !p.enabled } : p
    )));
  }

  async function savePreferences() {
    setError('');
    setMessage('');
    try {
      await api.updateAlertPreferences({ preferences });
      setMessage('Preferências salvas.');
      setShowPrefs(false);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando alertas...</p>;

  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div>
      <PageHeaderWithHelp
        title="Alertas"
        subtitle="Notificações do rastreador via push no app."
        guideId="client_alerts"
        scope="client"
      >
        <div className="form-actions">
          {unread > 0 && (
            <button type="button" className="btn-secondary" onClick={markAllRead}>
              Marcar todos lidos
            </button>
          )}
          <button type="button" onClick={() => setShowPrefs(!showPrefs)}>
            {showPrefs ? 'Fechar' : 'Configurar'}
          </button>
        </div>
      </PageHeaderWithHelp>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showPrefs && (
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <h3>Preferências de alerta</h3>
          <div className="info-box">
            Alertas de veículo (ignição, rota, velocidade, etc.) chegam apenas por <strong>push</strong>.
            WhatsApp é reservado para cadastro, cobranças e promoções — evita bloqueio por excesso de mensagens.
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ativo</th>
                  <th>Push</th>
                </tr>
              </thead>
              <tbody>
                {preferences.map((pref, index) => (
                  <tr key={pref.alert_type}>
                    <td>{ALERT_TYPE_LABELS[pref.alert_type] || pref.alert_type}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={pref.enabled}
                        onChange={() => toggleEnabled(index)}
                      />
                    </td>
                    <td>
                      <input type="checkbox" checked disabled title="Push sempre ativo para alertas de veículo" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="button" onClick={savePreferences}>Salvar</button>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="info-box">Nenhum alerta recebido ainda.</div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-card card ${alert.read ? '' : 'unread'}`}>
              <div className="alert-card-header">
                <div>
                  <h3>{alert.title}</h3>
                  <small className="muted">
                    {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                    {alert.vehicle_plate ? ` · ${alert.vehicle_plate}` : ''}
                    {' · '}{formatDate(alert.created_at)}
                  </small>
                </div>
                {!alert.read && (
                  <button type="button" className="btn-sm btn-secondary" onClick={() => markRead(alert.id)}>
                    Marcar lido
                  </button>
                )}
              </div>
              <p>{alert.message}</p>
              {alert.channels_sent?.length > 0 && (
                <div className="card-meta">
                  {alert.channels_sent.map((c) => (
                    <span key={c} className="badge info">{CHANNEL_LABELS[c] || c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
