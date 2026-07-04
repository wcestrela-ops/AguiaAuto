import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function ClientRegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf_cnpj: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.register(form);
      navigate('/app');
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
          <h1>Criar conta</h1>
          <p>Águia Gestão Veicular</p>
        </div>

        <label>Nome<input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label>
        <label>E-mail<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
        <label>Telefone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
        <label>CPF/CNPJ<input value={form.cpf_cnpj} onChange={(e) => update('cpf_cnpj', e.target.value)} /></label>
        <label>Senha<input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={6} required /></label>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>

        <p className="text-center muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
