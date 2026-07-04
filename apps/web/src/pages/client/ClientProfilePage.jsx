import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function ClientProfilePage() {
  const [profile, setProfile] = useState({ name: '', phone: '', email: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const push = usePushNotifications();

  useEffect(() => {
    api.getPerfil()
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.message));
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.updatePerfil({ name: profile.name, phone: profile.phone });
      setProfile(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setMessage('Perfil atualizado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.changePassword(passwords.current_password, passwords.new_password);
      setMessage('Senha alterada. Faça login novamente.');
      setPasswords({ current_password: '', new_password: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEnablePush() {
    setMessage('');
    setError('');
    try {
      await push.enablePush();
      setMessage('Notificações push ativadas neste dispositivo.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDisablePush() {
    setMessage('');
    setError('');
    try {
      await push.disablePush();
      setMessage('Notificações push desativadas.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTestPush() {
    setMessage('');
    setError('');
    try {
      await push.sendTestPush();
      setMessage('Notificação de teste enviada!');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie seus dados, senha e notificações.</p>
      </header>

      <div className="form-card">
        <h3>🔔 Notificações Push</h3>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Firebase configurado pelo administrador. Ative para receber alertas de veículos, cobranças e emergências.
        </p>

        <div className="card-meta" style={{ marginBottom: '1rem' }}>
          <span className={`badge ${push.isEnabled ? 'success' : 'warning'}`}>
            {push.isEnabled ? 'Ativado' : 'Desativado'}
          </span>
          {push.status === 'denied' && <span className="badge error">Permissão negada</span>}
        </div>

        <div className="form-actions">
          {!push.isEnabled ? (
            <button type="button" onClick={handleEnablePush} disabled={push.status === 'loading'}>
              {push.status === 'loading' ? 'Ativando...' : 'Ativar notificações'}
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={handleTestPush}>
                Enviar teste
              </button>
              <button type="button" className="btn-danger btn-sm" onClick={handleDisablePush}>
                Desativar
              </button>
            </>
          )}
        </div>

        {push.devices.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <strong style={{ fontSize: '0.875rem' }}>Dispositivos registrados:</strong>
            <ul className="device-list">
              {push.devices.map((d) => (
                <li key={d.id}>
                  {d.platform} — {d.device_name?.slice(0, 40) || 'Dispositivo'}
                  <small>{d.token}</small>
                </li>
              ))}
            </ul>
          </div>
        )}

        {push.error && <div className="alert error" style={{ marginTop: '0.75rem' }}>{push.error}</div>}
      </div>

      <form className="form-card" onSubmit={saveProfile}>
        <h3>Dados pessoais</h3>
        <label>E-mail<input value={profile.email || ''} disabled /></label>
        <label>Nome<input value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
        <label>Telefone<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
        <button type="submit">Salvar perfil</button>
      </form>

      <form className="form-card" onSubmit={savePassword}>
        <h3>Alterar senha</h3>
        <label>Senha atual<input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></label>
        <label>Nova senha<input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} minLength={6} /></label>
        <button type="submit">Alterar senha</button>
      </form>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
    </div>
  );
}
