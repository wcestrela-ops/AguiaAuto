import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { hasPlatformAccess } from '../../lib/platform-access';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.adminLogin({
        email,
        password,
        totp_code: totpCode || undefined,
      });

      if (result.requires_2fa) {
        setRequires2fa(true);
        setError(result.message || 'Informe o código 2FA.');
        return;
      }

      if (result.requires_2fa_setup) {
        setError(result.message || 'Configure 2FA antes de continuar.');
        return;
      }

      const user = result.user || api.getStoredAdminUser();
      if (hasPlatformAccess(user) && user?.role?.startsWith('platform_')) {
        navigate('/platform');
        return;
      }

      navigate('/admin');
    } catch (err) {
      api.clearAdminSession();
      setError(err.message || 'Falha no login administrativo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-icon">🦅</span>
          <h1>Águia Gestão Veicular</h1>
          <p>Painel Administrativo</p>
        </div>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@empresa.com"
            required
            autoComplete="username"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            required
            autoComplete="current-password"
          />
        </label>

        {requires2fa && (
          <label>
            Código 2FA
            <input
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
            />
          </label>
        )}

        {error && <div className="alert error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="hint" style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
          Use sua conta administrativa individual. O token ADMIN_SECRET legado será descontinuado.
        </p>
      </form>
    </div>
  );
}
