import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminSecurityPage() {
  const [dashboard, setDashboard] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [twoFaSetup, setTwoFaSetup] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [dash, sess, logs] = await Promise.all([
        api.getSecurityDashboard(),
        api.getAdminSessions(),
        api.getAdminLoginAttempts(),
      ]);
      setDashboard(dash);
      setSessions(sess);
      setAttempts(logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function start2fa() {
    setError('');
    try {
      const data = await api.setupAdmin2fa();
      setTwoFaSetup(data);
      setMessage('Escaneie o QR/secret no autenticador e confirme com o código.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirm2fa() {
    setError('');
    try {
      const data = await api.verifyAdmin2fa(twoFaCode);
      setRecoveryCodes(data.recovery_codes || []);
      setTwoFaSetup(null);
      setTwoFaCode('');
      setMessage('2FA ativado com sucesso. Guarde os códigos de recuperação.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeSession(id) {
    await api.revokeAdminSession(id);
    await loadAll();
  }

  async function revokeOthers() {
    await api.revokeOtherAdminSessions();
    setMessage('Outras sessões encerradas.');
    await loadAll();
  }

  if (loading) return <p>Carregando segurança...</p>;

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>Segurança</h1>
          <p>Sessões, 2FA, tentativas de login e indicadores.</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {dashboard && (
        <section className="card-grid">
          <div className="card"><strong>Logins 24h</strong><span>{dashboard.logins_24h}</span></div>
          <div className="card"><strong>Falhas 24h</strong><span>{dashboard.login_failures_24h}</span></div>
          <div className="card"><strong>Sessões ativas</strong><span>{dashboard.active_admin_sessions}</span></div>
          <div className="card"><strong>Admins sem 2FA</strong><span>{dashboard.admins_without_2fa}</span></div>
        </section>
      )}

      <section className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Autenticação em dois fatores</h2>
        {!twoFaSetup ? (
          <button type="button" className="btn-secondary" onClick={start2fa}>Configurar 2FA</button>
        ) : (
          <div>
            <p>Secret: <code>{twoFaSetup.secret}</code></p>
            <p><a href={twoFaSetup.otpauth_url}>Abrir no autenticador</a></p>
            <input value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="Código 6 dígitos" />
            <button type="button" className="btn-primary" onClick={confirm2fa}>Confirmar 2FA</button>
          </div>
        )}
        {recoveryCodes.length > 0 && (
          <div className="alert warning">
            <strong>Códigos de recuperação (guarde agora):</strong>
            <pre>{recoveryCodes.join('\n')}</pre>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <h2>Sessões ativas</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={revokeOthers}>Encerrar outras sessões</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>IP</th>
              <th>Última atividade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.device_label || s.user_agent || '—'}</td>
                <td>{s.ip_address || '—'}</td>
                <td>{s.last_seen_at || s.created_at}</td>
                <td><button type="button" className="btn-ghost btn-sm" onClick={() => revokeSession(s.id)}>Revogar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Tentativas de login recentes</h2>
        <table className="data-table">
          <thead>
            <tr><th>E-mail</th><th>IP</th><th>Sucesso</th><th>Motivo</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{a.email || '—'}</td>
                <td>{a.ip_address || '—'}</td>
                <td>{a.success ? 'Sim' : 'Não'}</td>
                <td>{a.reason || '—'}</td>
                <td>{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
