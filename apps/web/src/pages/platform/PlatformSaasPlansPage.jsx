import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { getStoredAdminUser, hasPlatformPermission } from '../../lib/platform-access';

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  billing_cycle: 'MONTHLY',
  trial_days: '14',
  price_monthly: '0',
  status: 'ACTIVE',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlatformSaasPlansPage() {
  const user = getStoredAdminUser();
  const canManage = hasPlatformPermission(user, 'platform.billing.manage');

  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [plansRes, modulesRes] = await Promise.all([
        api.getPlatformSaasPlans(),
        api.getPlatformModules().catch(() => ({ data: [] })),
      ]);
      setPlans(plansRes.data || []);
      setModules(modulesRes.data || []);
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
    setSelectedModules([]);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function startEdit(plan) {
    setEditingId(plan.id);
    setForm({
      code: plan.code || '',
      name: plan.name || '',
      description: plan.description || '',
      billing_cycle: plan.billing_cycle || 'MONTHLY',
      trial_days: String(plan.trial_days ?? 14),
      price_monthly: String(plan.price_monthly ?? 0),
      status: plan.status || 'ACTIVE',
    });
    setShowForm(true);
    setError('');
    setMessage('');
    try {
      const detail = await api.getPlatformSaasPlan(plan.id);
      const codes = (detail.data?.modules || []).filter((m) => m.included).map((m) => m.code);
      setSelectedModules(codes);
    } catch {
      setSelectedModules([]);
    }
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedModules([]);
  }

  function toggleModule(code) {
    setSelectedModules((prev) => (
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    ));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      billing_cycle: form.billing_cycle,
      trial_days: Number(form.trial_days),
      price_monthly: Number(form.price_monthly),
      status: form.status,
      module_codes: selectedModules,
    };

    try {
      if (editingId) {
        await api.updatePlatformSaasPlan(editingId, payload);
        if (selectedModules.length) {
          await api.setPlatformSaasPlanModules(editingId, selectedModules);
        }
        setMessage('Plano atualizado.');
      } else {
        await api.createPlatformSaasPlan(payload);
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

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Planos SaaS</h1>
          <p className="muted">Planos comerciais da plataforma (distintos dos planos B2C de clientes finais).</p>
        </div>
        {canManage ? (
          <button type="button" onClick={showForm ? cancelForm : startCreate}>
            {showForm ? 'Cancelar' : 'Novo plano'}
          </button>
        ) : null}
      </header>

      <PageAlerts error={error} message={message} />

      {showForm && canManage ? (
        <form className="card form-grid" onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
          <h3>{editingId ? 'Editar plano' : 'Novo plano SaaS'}</h3>
          <label>
            Código
            <input value={form.code} onChange={(e) => updateForm('code', e.target.value)} required disabled={Boolean(editingId)} />
          </label>
          <label>
            Nome
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} required />
          </label>
          <label className="full-width">
            Descrição
            <textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={2} />
          </label>
          <label>
            Preço mensal (R$)
            <input type="number" min="0" step="0.01" value={form.price_monthly} onChange={(e) => updateForm('price_monthly', e.target.value)} />
          </label>
          <label>
            Trial (dias)
            <input type="number" min="0" value={form.trial_days} onChange={(e) => updateForm('trial_days', e.target.value)} />
          </label>
          <label>
            Ciclo
            <select value={form.billing_cycle} onChange={(e) => updateForm('billing_cycle', e.target.value)}>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="SEMIANNUAL">Semestral</option>
              <option value="ANNUAL">Anual</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </label>

          {modules.length > 0 ? (
            <div className="full-width">
              <p><strong>Módulos incluídos</strong></p>
              <div className="checkbox-grid">
                {modules.map((mod) => (
                  <label key={mod.code} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod.code)}
                      onChange={() => toggleModule(mod.code)}
                    />
                    {mod.code} — {mod.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar plano'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading ? (
        <table className="table-card">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Preço/mês</th>
              <th>Módulos</th>
              <th>Status</th>
              {canManage ? <th>Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td><code>{plan.code}</code></td>
                <td>
                  <strong>{plan.name}</strong>
                  {plan.description ? <div className="muted">{plan.description}</div> : null}
                </td>
                <td>{formatMoney(plan.price_monthly)}</td>
                <td>{plan.modules_count ?? '—'}</td>
                <td><span className="badge success">{plan.status}</span></td>
                {canManage ? (
                  <td>
                    <button type="button" className="btn-link" onClick={() => startEdit(plan)}>Editar</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
