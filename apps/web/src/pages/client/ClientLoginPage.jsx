import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(email, password);
      const role = res.data?.user?.role || api.getStoredUser().role;
      navigate(role === 'installer' ? '/instalador' : '/app');
    } catch (err) {
      setError(err.message);
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
          <p>Área do Cliente</p>
        </div>

        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

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
          <Link to="/admin/login">Acesso administrativo</Link>
        </p>
      </form>
    </div>
  );
}
