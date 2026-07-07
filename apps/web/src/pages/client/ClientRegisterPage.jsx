import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ClientRegisterPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf_cnpj: '', password: '', plan_id: '', billing_type: 'UNDEFINED',
  });
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getPlans()
      .then((res) => {
        const list = res.data || [];
        setPlans(list);
        if (list.length === 1) {
          setForm((prev) => ({ ...prev, plan_id: String(list[0].id) }));
        }
      })
      .catch(() => {});
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const payload = {
        ...form,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
      };
      const res = await api.register(payload);

      const prov = res.data?.provisioning;
      if (prov?.status === 'completed') {
        setMessage('Conta criada! Cliente registrado no Asaas e GPSWOX automaticamente.');
      } else if (prov?.status === 'partial') {
        setMessage('Conta criada com provisionamento parcial. Nossa equipe finalizará em breve.');
      } else if (form.plan_id) {
        setMessage('Conta criada. O provisionamento será concluído em breve.');
      }

      const target = await api.getClientAppPath();
      setTimeout(() => navigate(target), prov ? 1500 : 0);
      if (!prov) navigate(target);
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
        <label>CPF/CNPJ<input value={form.cpf_cnpj} onChange={(e) => update('cpf_cnpj', e.target.value)} required /></label>

        {plans.length > 0 && (
          <label>
            Plano
            <select value={form.plan_id} onChange={(e) => update('plan_id', e.target.value)} required>
              <option value="">Selecione um plano...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatMoney(plan.price_monthly)}/mês
                </option>
              ))}
            </select>
            <small className="hint">Ao cadastrar, criamos sua conta no Asaas e GPSWOX automaticamente.</small>
          </label>
        )}

        <label>Senha<input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={6} required /></label>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

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
