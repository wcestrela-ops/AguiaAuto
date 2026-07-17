import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { getStoredAdminUser, hasPlatformPermission } from '../../lib/platform-access';

function moduleStatusClass(status) {
  const s = String(status || 'INACTIVE').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL') return 'info';
  if (s === 'SUSPENDED') return 'error';
  return 'warning';
}

function formatMetric(key, value) {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR');
}

export default function PlatformTenantDetailPage() {
  const { id } = useParams();
  const user = getStoredAdminUser();
  const canManageModules = hasPlatformPermission(user, 'platform.modules.manage');
  const canManageBilling = hasPlatformPermission(user, 'platform.billing.manage');
  const canViewBilling = hasPlatformPermission(user, 'platform.billing.view');

  const [tenant, setTenant] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [tenantRes, subRes, usageRes, plansRes] = await Promise.all([
        api.getPlatformTenant(id),
        canViewBilling ? api.getPlatformTenantSubscription(id).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        canViewBilling ? api.getPlatformTenantUsage(id).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        canViewBilling ? api.getPlatformSaasPlans().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setTenant(tenantRes.data);
      setSubscription(subRes.data);
      setUsage(usageRes.data);
      setPlans(plansRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function toggleModule(code, isActive) {
    setError('');
    try {
      if (isActive) {
        await api.suspendPlatformTenantModule(id, code);
        setMessage(`Módulo ${code} suspenso.`);
      } else {
        await api.activatePlatformTenantModule(id, code);
        setMessage(`Módulo ${code} ativado.`);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function assignPlan(e) {
    e.preventDefault();
    if (!selectedPlanId) return;
    setError('');
    try {
      await api.assignPlatformTenantSubscription(id, { plan_id: Number(selectedPlanId) });
      setMessage('Plano atribuído com sucesso.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshUsage() {
    setError('');
    try {
      await api.refreshPlatformTenantUsage(id);
      setMessage('Métricas atualizadas.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (!tenant) return <p className="muted">Empresa não encontrada.</p>;

  const modules = tenant.modules || [];
  const sub = subscription?.subscription;
  const plan = subscription?.plan;

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="muted"><Link to="/platform/tenants">← Empresas</Link></p>
          <h1>{tenant.trade_name || tenant.name}</h1>
          <p className="muted">ID {tenant.id} · <code>{tenant.slug}</code></p>
        </div>
        <span className={`badge ${tenant.status === 'ACTIVE' ? 'success' : 'warning'}`}>{tenant.status}</span>
      </header>

      <PageAlerts error={error} message={message} />

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Dados da empresa</h3>
        <dl className="detail-grid">
          <div><dt>Razão social</dt><dd>{tenant.legal_name || '—'}</dd></div>
          <div><dt>E-mail</dt><dd>{tenant.email || '—'}</dd></div>
          <div><dt>Telefone</dt><dd>{tenant.phone || '—'}</dd></div>
          <div><dt>Timezone</dt><dd>{tenant.timezone || '—'}</dd></div>
          <div><dt>Moeda</dt><dd>{tenant.currency || '—'}</dd></div>
          <div><dt>Criado em</dt><dd>{new Date(tenant.created_at).toLocaleString('pt-BR')}</dd></div>
        </dl>
      </section>

      {canViewBilling ? (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>Assinatura SaaS</h3>
          {sub ? (
            <dl className="detail-grid">
              <div><dt>Plano</dt><dd>{plan?.name || sub.plan_name || sub.plan_code || '—'}</dd></div>
              <div><dt>Status</dt><dd><span className="badge info">{sub.status}</span></dd></div>
              <div><dt>Ciclo</dt><dd>{sub.billing_cycle}</dd></div>
              <div><dt>Período</dt><dd>
                {sub.current_period_start ? new Date(sub.current_period_start).toLocaleDateString('pt-BR') : '—'}
                {' → '}
                {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}
              </dd></div>
            </dl>
          ) : (
            <p className="muted">Nenhuma assinatura ativa.</p>
          )}

          {canManageBilling ? (
            <form onSubmit={assignPlan} className="inline-form" style={{ marginTop: '1rem' }}>
              <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} required>
                <option value="">Selecionar plano...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
              <button type="submit">Atribuir plano</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canViewBilling && usage ? (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="page-header" style={{ marginBottom: '1rem' }}>
            <h3>Uso vs limites</h3>
            {canManageBilling ? (
              <button type="button" className="btn-secondary" onClick={refreshUsage}>Atualizar métricas</button>
            ) : null}
          </div>
          <table className="table-card">
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Atual</th>
                <th>Limite</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(usage.usage || {}).map(([key, row]) => (
                <tr key={key}>
                  <td>{key.replace('max_', '')}</td>
                  <td>{formatMetric(key, row.current)}</td>
                  <td>{row.limit == null ? '∞' : formatMetric(key, row.limit)}</td>
                  <td>{row.percent != null ? `${row.percent}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {usage.measured_at ? (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Medido em: {new Date(usage.measured_at).toLocaleString('pt-BR')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h3>Módulos</h3>
        <table className="table-card">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Status</th>
              {canManageModules ? <th>Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => {
              const isActive = ['ACTIVE', 'TRIAL'].includes(String(mod.status || '').toUpperCase());
              return (
                <tr key={mod.code}>
                  <td><code>{mod.code}</code></td>
                  <td>{mod.name}</td>
                  <td>{mod.category || '—'}</td>
                  <td><span className={`badge ${moduleStatusClass(mod.status)}`}>{mod.status || 'INATIVO'}</span></td>
                  {canManageModules ? (
                    <td>
                      <button type="button" className="btn-link" onClick={() => toggleModule(mod.code, isActive)}>
                        {isActive ? 'Suspender' : 'Ativar'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
