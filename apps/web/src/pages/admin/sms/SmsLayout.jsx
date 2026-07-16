import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { smsApi } from '../../../api/sms-client';
import '../../../styles/sms-hub.css';

const SUB_NAV = [
  { to: '/admin/sms', label: 'Início', end: true },
  { to: '/admin/sms/devices', label: 'Dispositivos' },
  { to: '/admin/sms/send', label: 'Enviar' },
  { to: '/admin/sms/history', label: 'Histórico' },
  { to: '/admin/sms/more', label: 'Mais' },
];

function SmsBootstrap({ onReady }) {
  const [email, setEmail] = useState('admin@agsmshub.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError('');
      setLoading(true);
      try {
        const aguiaToken = api.adminToken || localStorage.getItem('admin_token');
        if (aguiaToken) {
          await smsApi.bridgeFromAguiaAdmin(aguiaToken);
          if (!cancelled) onReady();
          return;
        }
      } catch {
        // Bridge indisponível — exibe login SMS manual
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, [onReady]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await smsApi.login(email, password);
      onReady();
    } catch (err) {
      setError(err.message || 'Falha no login AG SMS');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="sms-module">
        <div className="sms-card sms-bootstrap">
          <p style={{ color: 'var(--muted)' }}>Conectando módulo AG SMS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sms-module">
      <header className="page-header">
        <h1>AG SMS Hub</h1>
        <p>Autentique-se no módulo SMS para continuar.</p>
      </header>
      <form className="sms-card sms-bootstrap" onSubmit={handleLogin}>
        <div className="input-group">
          <label htmlFor="sms-email">E-mail SMS Hub</label>
          <input id="sms-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="input-group">
          <label htmlFor="sms-password">Senha</label>
          <input
            id="sms-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button type="submit" className="sms-btn" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar no AG SMS'}
        </button>
      </form>
    </div>
  );
}

export default function SmsLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(() => smsApi.isAuthenticated());

  if (!ready) {
    return <SmsBootstrap onReady={() => setReady(true)} />;
  }

  return (
    <div className="sms-module">
      <header className="page-header">
        <h1>AG SMS Hub</h1>
        <p>Comandos SMS para rastreadores — integrado ao painel Águia.</p>
      </header>

      <nav className="sms-subnav">
        {SUB_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className="btn-ghost"
          style={{ marginLeft: 'auto', fontSize: '0.875rem' }}
          onClick={async () => {
            await smsApi.logout();
            navigate('/admin');
          }}
        >
          Sair do SMS
        </button>
      </nav>

      <Outlet />

      <nav className="sms-mobile-nav">
        {SUB_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
