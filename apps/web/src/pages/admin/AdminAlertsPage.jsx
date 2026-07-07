import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ALERT_TYPE_LABELS, CHANNEL_LABELS } from '../../utils/alerts';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [config, setConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testUserId, setTestUserId] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoUserIds, setPromoUserIds] = useState([]);
  const [promoAll, setPromoAll] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [alertsRes, configRes, usersRes] = await Promise.all([
        api.getAdminAlerts(),
        api.getAdminAlertConfig(),
        api.getAdminUsers(),
      ]);
      setAlerts(alertsRes.data || []);
      setConfig(configRes.data);
      setUsers(usersRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function sendTest() {
    if (!testUserId) return;
    setError('');
    setMessage('');
    try {
      const res = await api.sendTestAlert(testUserId);
      setMessage(`Teste enviado via: ${res.data?.channels_sent?.join(', ') || 'nenhum canal'}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendPromotion() {
    if (!promoMessage.trim()) return;
    setError('');
    setMessage('');
    try {
      const res = await api.sendPromotion({
        message: promoMessage.trim(),
        user_ids: promoAll ? undefined : promoUserIds.map(Number),
        all_clients: promoAll,
      });
      setMessage(`Promoção enviada para ${res.data?.sent ?? 0} cliente(s).`);
      setPromoMessage('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Alertas</h1>
          <p>Motor GPSWOX → Push (veículo) · WhatsApp só transacional</p>
        </div>
        <Link to="/admin/integracoes/alertas" className="btn-secondary" style={{ padding: '0.625rem 1rem', borderRadius: '8px' }}>
          Configurar motor
        </Link>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {config && (
        <div className="info-box">
          <strong>Motor:</strong> {config.enabled ? 'Ativo' : 'Desativado'} ·
          Alertas de veículo: <strong>apenas push</strong> (ignição, rota e velocidade não vão ao WhatsApp)
          <br />
          <strong>WhatsApp permitido:</strong> cadastro, cobranças, recuperação de senha e promoções manuais abaixo.
          <br />
          <strong>Webhook GPSWOX:</strong> POST /webhooks/gpswox
          {config.webhook_secret ? ' (com segredo)' : ''}
        </div>
      )}

      <div className="form-card">
        <h3>Promoção via WhatsApp</h3>
        <p className="muted">Envio manual pelo admin — não use para alertas de veículo.</p>
        <label>
          Mensagem
          <textarea
            rows={4}
            value={promoMessage}
            onChange={(e) => setPromoMessage(e.target.value)}
            placeholder="Texto da promoção..."
          />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={promoAll} onChange={(e) => setPromoAll(e.target.checked)} />
          Enviar para todos os clientes com telefone
        </label>
        {!promoAll && (
          <label>
            Clientes (segure Ctrl para múltiplos)
            <select
              multiple
              value={promoUserIds}
              onChange={(e) => setPromoUserIds([...e.target.selectedOptions].map((o) => o.value))}
              style={{ minHeight: '120px' }}
            >
              {users.filter((u) => u.phone).map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={sendPromotion} disabled={!promoMessage.trim()}>
          Enviar promoção
        </button>
      </div>

      <div className="form-card">
        <h3>Teste de push (alerta de veículo)</h3>
        <label>
          Cliente
          <select value={testUserId} onChange={(e) => setTestUserId(e.target.value)}>
            <option value="">Selecione...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={sendTest} disabled={!testUserId}>Enviar teste</button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Mensagem</th>
              <th>Canais</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan={6} className="muted">Nenhum alerta registrado.</td></tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{formatDate(alert.created_at)}</td>
                  <td>{alert.user_name || alert.user_email}</td>
                  <td>{ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}</td>
                  <td>{alert.message}</td>
                  <td>
                    {(alert.channels_sent || []).map((c) => (
                      <span key={c} className="badge info" style={{ marginRight: '0.25rem' }}>
                        {CHANNEL_LABELS[c] || c}
                      </span>
                    ))}
                  </td>
                  <td><span className="badge info">{alert.delivery_status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
