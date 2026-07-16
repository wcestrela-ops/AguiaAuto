import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function ClientLoginPage() {
  const [email, setEmail] = useState(() => api.getSavedEmail());
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => api.getRememberMePreference() || true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    api.ensureClientSession()
      .then(async (user) => {
        if (cancelled || !user) return;
        if (user.role === 'installer') {
          navigate('/instalador', { replace: true });
        } else {
          navigate(await api.getClientAppPath(), { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(email, password, { remember_me: rememberMe });
      const role = res.data?.user?.role || api.getStoredUser().role;
      if (role === 'installer') {
        navigate('/instalador');
      } else {
        navigate(await api.getClientAppPath());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="login-page">
        <p className="muted">Verificando sessão...</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-icon">🦅</span>
          <h1>Águia Gestão Veicular</h1>
          <p>Área do Cliente</p>
        </div>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username email"
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={rememberMe ? 'current-password' : 'password'}
            required
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Manter conectado neste dispositivo
        </label>
        <small className="field-hint">
          Com esta opção ativa, você não precisa entrar de novo ao reabrir o app (PWA).
          O e-mail fica salvo para facilitar o próximo acesso.
        </small>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center muted">
          <Link to="/recuperar-senha">Esqueci minha senha</Link>
        </p>
        <p className="text-center muted">
          Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
        <p className="text-center muted">
          <Link to="/">Voltar ao site</Link>
        </p>
        <p className="text-center muted">
          <Link to="/admin/login">Acesso administrativo</Link>
        </p>
      </form>
    </div>
  );
}
