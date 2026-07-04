import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      api.setToken(token);
      await api.getIntegrations();
      navigate('/admin');
    } catch {
      api.clearToken();
      setError('Token inválido. Use o ADMIN_SECRET configurado no servidor.');
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
          Token de acesso
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_SECRET"
            required
          />
        </label>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
