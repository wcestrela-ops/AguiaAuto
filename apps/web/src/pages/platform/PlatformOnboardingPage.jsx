import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { getStoredAdminUser, hasPlatformPermission } from '../../lib/platform-access';

const EMPTY_FORM = {
  company_name: '',
  trade_name: '',
  slug: '',
  company_email: '',
  company_phone: '',
  document_number: '',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  owner_password: '',
  plan_id: '',
  trial_days: '14',
};

export default function PlatformOnboardingPage() {
  const navigate = useNavigate();
  const user = getStoredAdminUser();
  const canCreate = hasPlatformPermission(user, 'platform.tenants.create');

  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getPlatformOnboardingPlans().catch(() => ({ data: [] })),
    ])
      .then(([plansRes]) => {
        setPlans(plansRes.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    setResult(null);

    try {
      const res = await api.createPlatformTenantOnboarding({
        company: {
          name: form.company_name.trim(),
          trade_name: form.trade_name.trim() || form.company_name.trim(),
          slug: form.slug.trim() || undefined,
          email: form.company_email.trim() || undefined,
          phone: form.company_phone.trim() || undefined,
          document_number: form.document_number.trim() || undefined,
        },
        owner: {
          name: form.owner_name.trim(),
          email: form.owner_email.trim(),
          phone: form.owner_phone.trim() || undefined,
          password: form.owner_password.trim() || undefined,
        },
        plan_id: Number(form.plan_id),
        trial_days: Number(form.trial_days || 14),
      });

      setResult(res.data);
      setMessage('Empresa onboardada com sucesso.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return (
      <div>
        <p className="muted">Sem permissão para criar empresas.</p>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="muted"><Link to="/platform/tenants">← Empresas</Link></p>
          <h1>Onboarding B2B</h1>
          <p className="muted">Cadastre uma nova empresa na plataforma com plano SaaS, integrações SHARED e owner admin.</p>
        </div>
      </header>

      <PageAlerts error={error} message={message} />

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading && !result ? (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3>Dados da empresa</h3>
          <label>
            Razão social / Nome
            <input value={form.company_name} onChange={(e) => updateField('company_name', e.target.value)} required />
          </label>
          <label>
            Nome fantasia
            <input value={form.trade_name} onChange={(e) => updateField('trade_name', e.target.value)} />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="auto-gerado" />
          </label>
          <label>
            E-mail corporativo
            <input type="email" value={form.company_email} onChange={(e) => updateField('company_email', e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={form.company_phone} onChange={(e) => updateField('company_phone', e.target.value)} />
          </label>
          <label>
            CNPJ/CPF (opcional)
            <input value={form.document_number} onChange={(e) => updateField('document_number', e.target.value)} />
          </label>

          <h3 className="full-width">Responsável (TENANT_OWNER)</h3>
          <label>
            Nome
            <input value={form.owner_name} onChange={(e) => updateField('owner_name', e.target.value)} required />
          </label>
          <label>
            E-mail login admin
            <input type="email" value={form.owner_email} onChange={(e) => updateField('owner_email', e.target.value)} required />
          </label>
          <label>
            Telefone
            <input value={form.owner_phone} onChange={(e) => updateField('owner_phone', e.target.value)} />
          </label>
          <label>
            Senha inicial (opcional)
            <input type="password" value={form.owner_password} onChange={(e) => updateField('owner_password', e.target.value)} placeholder="Gerada automaticamente se vazio" />
          </label>

          <h3 className="full-width">Plano SaaS</h3>
          <label>
            Plano
            <select value={form.plan_id} onChange={(e) => updateField('plan_id', e.target.value)} required>
              <option value="">Selecionar...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </label>
          <label>
            Trial (dias)
            <input type="number" min="0" value={form.trial_days} onChange={(e) => updateField('trial_days', e.target.value)} />
          </label>

          <div className="form-actions full-width">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Provisionando...' : 'Criar empresa'}
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <section className="card">
          <h3>Empresa criada</h3>
          <dl className="detail-grid">
            <div><dt>ID</dt><dd>{result.tenant.id}</dd></div>
            <div><dt>Slug</dt><dd><code>{result.tenant.slug}</code></dd></div>
            <div><dt>Plano</dt><dd>{result.plan?.name}</dd></div>
            <div><dt>Owner</dt><dd>{result.owner.email}</dd></div>
            {result.owner.temporary_password ? (
              <div><dt>Senha temporária</dt><dd><code>{result.owner.temporary_password}</code></dd></div>
            ) : null}
          </dl>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" onClick={() => navigate(`/platform/tenants/${result.tenant.id}`)}>
              Ver empresa
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setResult(null); setForm(EMPTY_FORM); }}>
              Nova empresa
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
