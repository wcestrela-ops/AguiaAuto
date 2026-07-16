import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';

const EMPTY_FORM = {
  name: '',
  description: '',
  price_monthly: '',
  active: true,
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getAdminPlans();
      setPlans(res.data || []);
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

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name || '',
      description: plan.description || '',
      price_monthly: String(plan.price_monthly ?? ''),
      active: plan.active !== false,
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_monthly: Number(form.price_monthly),
      active: form.active,
    };

    try {
      if (editingId) {
        await api.updateAdminPlan(editingId, payload);
        setMessage('Plano atualizado.');
      } else {
        await api.createAdminPlan(payload);
        setMessage('Plano criado.');
      }
      cancelForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(plan) {
    setError('');
    try {
      await api.updateAdminPlan(plan.id, { active: !plan.active });
      setMessage(`Plano ${plan.active ? 'desativado' : 'ativado'}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeaderWithHelp
        title="Planos"
        subtitle="Planos exibidos no cadastro online e na landing page pública."
        guideId="admin_plans"
      >
        <button type="button" onClick={showForm ? cancelForm : startCreate}>
          {showForm ? 'Cancelar' : 'Novo plano'}
        </button>
      </PageHeaderWithHelp>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>{editingId ? `Editar plano #${editingId}` : 'Novo plano'}</h3>

          <label>
            Nome *
            <input
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              required
              placeholder="Ex.: Básico, Premium"
            />
          </label>

          <label>
            Descrição
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={3}
              placeholder="Benefícios incluídos no plano"
            />
          </label>

          <label>
            Valor mensal (R$) *
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price_monthly}
              onChange={(e) => updateForm('price_monthly', e.target.value)}
              required
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateForm('active', e.target.checked)}
            />
            Plano ativo (visível no cadastro e landing)
          </label>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelForm}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Carregando planos...</p>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Valor/mês</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr><td colSpan={5} className="muted">Nenhum plano cadastrado.</td></tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id}>
                    <td><strong>{plan.name}</strong></td>
                    <td>{plan.description || '—'}</td>
                    <td>{formatMoney(plan.price_monthly)}</td>
                    <td>
                      <span className={`badge ${plan.active ? 'success' : 'warning'}`}>
                        {plan.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(plan)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => toggleActive(plan)}>
                        {plan.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
