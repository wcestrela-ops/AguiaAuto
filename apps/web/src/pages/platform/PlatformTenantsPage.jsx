import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { getStoredAdminUser, hasPlatformPermission } from '../../lib/platform-access';

const EMPTY_FORM = {
  name: '',
  trade_name: '',
  slug: '',
  email: '',
  phone: '',
  status: 'TRIAL',
};

function tenantStatusClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL') return 'info';
  if (s === 'SUSPENDED') return 'error';
  return 'warning';
}

export default function PlatformTenantsPage() {
  const user = getStoredAdminUser();
  const canCreate = hasPlatformPermission(user, 'platform.tenants.create');
  const canManage = hasPlatformPermission(user, 'platform.tenants.suspend');

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getPlatformTenants();
      setTenants(res.data || []);
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

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await api.createPlatformTenant({
        name: form.name.trim(),
        trade_name: form.trade_name.trim() || form.name.trim(),
        slug: form.slug.trim() || undefined,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      });
      setMessage('Empresa criada.');
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function suspendTenant(id) {
    if (!window.confirm('Suspender esta empresa?')) return;
    setError('');
    try {
      await api.suspendPlatformTenant(id);
      setMessage('Empresa suspensa.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Empresas</h1>
          <p className="muted">Tenants cadastrados na plataforma SaaS.</p>
        </div>
        {canCreate ? (
          <div className="page-header-actions">
            <Link to="/platform/onboarding" className="btn-secondary">
              Onboarding B2B
            </Link>
            <button type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancelar' : 'Nova empresa'}
            </button>
          </div>
        ) : null}
      </header>

      <PageAlerts error={error} message={message} />

      {showForm && canCreate ? (
        <form className="card form-grid" onSubmit={handleCreate} style={{ marginBottom: '1.5rem' }}>
          <h3>Nova empresa</h3>
          <label>
            Nome
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} required />
          </label>
          <label>
            Nome fantasia
            <input value={form.trade_name} onChange={(e) => updateForm('trade_name', e.target.value)} />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(e) => updateForm('slug', e.target.value)} placeholder="auto-gerado" />
          </label>
          <label>
            E-mail
            <input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} />
          </label>
          <label>
            Status inicial
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Ativo</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Criar empresa'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading ? (
        <table className="table-card">
          <thead>
            <tr>
              <th>ID</th>
              <th>Empresa</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>
                  <strong>{t.trade_name || t.name}</strong>
                  {t.email ? <div className="muted">{t.email}</div> : null}
                </td>
                <td><code>{t.slug}</code></td>
                <td><span className={`badge ${tenantStatusClass(t.status)}`}>{t.status}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                  <Link to={`/platform/tenants/${t.id}`}>Detalhes</Link>
                  {canManage && t.status !== 'SUSPENDED' ? (
                    <>
                      {' · '}
                      <button type="button" className="btn-link danger" onClick={() => suspendTenant(t.id)}>
                        Suspender
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && tenants.length === 0 ? (
        <p className="muted">Nenhuma empresa cadastrada.</p>
      ) : null}
    </div>
  );
}
