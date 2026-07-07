import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const BILLING_TYPES = [
  { value: 'UNDEFINED', label: 'Cliente escolhe (link)' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminFinanceiroPage() {
  const [charges, setCharges] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    value: '',
    due_date: addDays(3),
    billing_type: 'UNDEFINED',
    description: 'Mensalidade Águia',
    plan_id: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reprovisioning, setReprovisioning] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [chargesRes, usersRes, plansRes] = await Promise.all([
        api.getAdminCharges(),
        api.getAdminUsers(),
        api.getAdminPlans(),
      ]);
      setCharges(chargesRes.data || []);
      setUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectPlan(planId) {
    const plan = plans.find((p) => String(p.id) === String(planId));
    updateForm('plan_id', planId);
    if (plan) {
      updateForm('value', String(plan.price_monthly));
      updateForm('description', `Plano ${plan.name}`);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createAdminCharge({
        user_id: Number(form.user_id),
        value: Number(form.value),
        due_date: form.due_date,
        billing_type: form.billing_type,
        description: form.description,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
      });
      setMessage('Cobrança criada e enviada ao cliente.');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReprovision(userId) {
    setReprovisioning(userId);
    setError('');
    setMessage('');
    try {
      const res = await api.reprovisionUser(userId);
      setMessage(`Provisionamento: ${res.data?.status || 'concluído'}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReprovisioning(null);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Financeiro</h1>
          <p>Crie cobranças manualmente e gerencie provisionamento Asaas + GPSWOX.</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}>Nova cobrança</button>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <h3>Nova cobrança</h3>

          <label>
            Cliente <span className="required">*</span>
            <select value={form.user_id} onChange={(e) => updateForm('user_id', e.target.value)} required>
              <option value="">Selecione...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email} — {user.provisioning_status || 'pending'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Plano (opcional)
            <select value={form.plan_id} onChange={(e) => selectPlan(e.target.value)}>
              <option value="">Avulsa</option>
              {plans.filter((p) => p.active).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatMoney(plan.price_monthly)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Valor (R$) <span className="required">*</span>
            <input type="number" step="0.01" min="0" value={form.value} onChange={(e) => updateForm('value', e.target.value)} required />
          </label>

          <label>
            Vencimento <span className="required">*</span>
            <input type="date" value={form.due_date} onChange={(e) => updateForm('due_date', e.target.value)} required />
          </label>

          <label>
            Forma de pagamento
            <select value={form.billing_type} onChange={(e) => updateForm('billing_type', e.target.value)}>
              {BILLING_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label>
            Descrição
            <input value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
          </label>

          <div className="form-actions">
            <button type="submit">Criar cobrança</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="info-box">
        <strong>Provisionamento automático:</strong> ao cadastrar com plano, o sistema cria cliente no Asaas e GPSWOX.
        Use &quot;Reprovisionar&quot; se algo falhou.
      </div>

      <div className="table-card" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Asaas</th>
              <th>GPSWOX</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || user.email}</td>
                <td><code>{user.asaas_customer_id || '—'}</code></td>
                <td><code>{user.gpswox_user_id || '—'}</code></td>
                <td>
                  <span className={`badge ${user.provisioning_status === 'completed' ? 'success' : 'warning'}`}>
                    {user.provisioning_status || 'pending'}
                  </span>
                </td>
                <td className="actions">
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    disabled={reprovisioning === user.id}
                    onClick={() => handleReprovision(user.id)}
                  >
                    {reprovisioning === user.id ? '...' : 'Reprovisionar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-header">
        <h2>Cobranças</h2>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr><td colSpan={6} className="muted">Nenhuma cobrança.</td></tr>
            ) : (
              charges.map((charge) => (
                <tr key={charge.id}>
                  <td>{charge.user_name || charge.user_email}</td>
                  <td>{charge.description}</td>
                  <td>{formatMoney(charge.amount)}</td>
                  <td>{formatDate(charge.due_date)}</td>
                  <td><span className="badge info">{charge.status}</span></td>
                  <td>
                    {charge.invoice_url ? (
                      <a href={charge.invoice_url} target="_blank" rel="noreferrer">Abrir</a>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
