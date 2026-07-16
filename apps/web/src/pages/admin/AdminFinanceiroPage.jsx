import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import ExportButtons from '../../components/ExportButtons';
import PageAlerts from '../../components/PageAlerts';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const BILLING_TYPES = [
  { value: 'PIX', label: 'PIX (recomendado)' },
  { value: 'UNDEFINED', label: 'Cliente escolhe (link)' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
];

const CHARGE_TYPES = [
  { value: 'monthly', label: 'Mensalidade recorrente' },
  { value: 'initial', label: 'Adesão inicial (Mercado Pago primeiro)' },
];

const PROVIDER_LABELS = {
  asaas: 'Asaas',
  mercadopago: 'Mercado Pago',
};

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

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function notificationBadge(notification) {
  if (!notification) {
    return { label: '—', badge: 'muted' };
  }
  if (notification.status === 'failed') {
    return { label: 'Falhou', badge: 'error' };
  }
  if (notification.channel === 'sms' && notification.used_fallback) {
    return { label: 'SMS (fallback)', badge: 'warning' };
  }
  if (notification.channel === 'whatsapp') {
    return { label: 'WhatsApp', badge: 'success' };
  }
  return { label: notification.channel || 'Enviado', badge: 'info' };
}

function notificationSummary(result) {
  if (!result?.notification) return 'Cobrança criada (sem lembrete — cliente sem telefone ou link).';
  const badge = notificationBadge(result.notification);
  return `Cobrança criada. Lembrete enviado via ${badge.label}.`;
}

export default function AdminFinanceiroPage() {
  const [charges, setCharges] = useState([]);
  const [billingNotifications, setBillingNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [gateways, setGateways] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    value: '',
    due_date: addDays(3),
    billing_type: 'PIX',
    charge_type: 'monthly',
    description: 'Mensalidade Águia',
    plan_id: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reprovisioning, setReprovisioning] = useState(null);
  const [billingAutomation, setBillingAutomation] = useState(null);
  const [manualPayment, setManualPayment] = useState(null);
  const [manualNotes, setManualNotes] = useState('');
  const [manualNotify, setManualNotify] = useState(true);
  const [submittingManual, setSubmittingManual] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [chargesRes, usersRes, plansRes, gatewaysRes, notificationsRes, automationRes] = await Promise.all([
        api.getAdminCharges(),
        api.getAdminUsers(),
        api.getAdminPlans(),
        api.getPaymentGateways(),
        api.getAdminBillingNotifications({ limit: 30 }),
        api.getBillingAutomationStatus().catch(() => ({ data: null })),
      ]);
      setCharges(chargesRes.data || []);
      setUsers(usersRes.data || []);
      setPlans(plansRes.data || []);
      setGateways(gatewaysRes.data);
      setBillingNotifications(notificationsRes.data || []);
      setBillingAutomation(automationRes.data || null);
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
      const res = await api.createAdminCharge({
        user_id: Number(form.user_id),
        value: Number(form.value),
        due_date: form.due_date,
        billing_type: form.billing_type,
        charge_type: form.charge_type,
        description: form.description,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
      });
      setMessage(notificationSummary(res.data));
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleManualPayment(e) {
    e.preventDefault();
    if (!manualPayment) return;
    setSubmittingManual(true);
    setError('');
    setMessage('');
    try {
      const res = await api.markManualPayment(manualPayment.id, {
        notes: manualNotes.trim() || undefined,
        send_notification: manualNotify,
      });
      const badge = notificationBadge(res.data?.notification);
      setMessage(
        res.data?.notification
          ? `Baixa manual registrada. Cliente notificado via ${badge.label}.`
          : 'Baixa manual registrada.',
      );
      setManualPayment(null);
      setManualNotes('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingManual(false);
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

  return (
    <div>
      <PageHeaderWithHelp
        title="Financeiro"
        subtitle="Crie cobranças manualmente e gerencie provisionamento Asaas + GPSWOX."
        guideId="financeiro"
      >
        <button type="button" onClick={() => setShowForm(true)} disabled={loading}>Nova cobrança</button>
      </PageHeaderWithHelp>

      <PageAlerts error={error} message={message} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : (
        <>
      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <SectionTitleWithHelp title="Nova cobrança" guideId="financeiro" />
          <p className="guide-inline">Adesão inicial usa Mercado Pago; mensalidade recorrente prefere Asaas (ajuste em Gateways de Pagamento).</p>

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
            Tipo de cobrança
            <select value={form.charge_type} onChange={(e) => updateForm('charge_type', e.target.value)}>
              {CHARGE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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

      {gateways && (
        <div className="card-grid">
          {Object.entries(gateways.providers || {}).map(([key, provider]) => (
            <div key={key} className="card">
              <h3>{provider.label}</h3>
              <span className={`badge ${provider.configured ? 'success' : 'warning'}`}>
                {provider.configured ? 'Configurado' : 'Pendente'}
              </span>
            </div>
          ))}
          <div className="card">
            <h3>Failover</h3>
            <p className="muted" style={{ fontSize: '0.8125rem' }}>
              Inicial: {gateways.config?.initial_primary} → {gateways.config?.initial_backup}
              <br />
              Recorrente: {gateways.config?.recurring_primary} → {gateways.config?.recurring_backup}
            </p>
            <Link to="/admin/integracoes/payment_gateways" className="btn-sm btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
              Configurar
            </Link>
          </div>
        </div>
      )}

      <div className="info-box">
        <strong>Lembretes automáticos:</strong> configure dias (vencimento, +1, +2, +3, +15), templates e SMS opcional em{' '}
        <Link to="/admin/integracoes/cobranca">Integrações → Cobrança e lembretes</Link>.
        {billingAutomation && (
          <>
            {' '}Última execução: {billingAutomation.last_run
              ? `${billingAutomation.last_run.reminders_sent} enviados · ${formatDateTime(billingAutomation.last_run.finished_at)}`
              : 'ainda não rodou'}
            {' '}· Dias ativos: {(billingAutomation.enabled_offsets || []).join(', ') || 'nenhum'}
          </>
        )}
      </div>

      <div className="info-box">
        <strong>Lembretes de cobrança:</strong> WhatsApp primeiro; SMS opcional (admin). Baixa manual disponível para pagamento em dinheiro/espécie.
      </div>

      <div className="info-box">
        <strong>Dois gateways:</strong> Mercado Pago para adesão inicial (PIX) e Asaas para recorrência.
        Se um falhar, o outro é usado automaticamente. Configure em Integrações → Gateways de Pagamento.
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
                <td><code>{user.tracker_user_id || '—'}</code></td>
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
        <ExportButtons resource="financeiro-cobrancas" />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Gateway</th>
              <th>Status</th>
              <th>Notificação</th>
              <th>Pagamento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr><td colSpan={10} className="muted">Nenhuma cobrança.</td></tr>
            ) : (
              charges.map((charge) => {
                const notify = notificationBadge(charge.last_notification);
                const canManualPay = !['paid', 'waived', 'refunded'].includes(charge.status);
                return (
                <tr key={charge.id}>
                  <td>{charge.user_name || charge.user_email}</td>
                  <td>{charge.description}</td>
                  <td>{formatMoney(charge.amount)}</td>
                  <td>{formatDate(charge.due_date)}</td>
                  <td><span className="badge info">{PROVIDER_LABELS[charge.payment_provider] || charge.payment_provider || '—'}</span></td>
                  <td><span className="badge info">{charge.status}</span></td>
                  <td>
                    <span className={`badge ${notify.badge}`}>{notify.label}</span>
                    {charge.last_notification?.created_at && (
                      <small className="muted" style={{ display: 'block' }}>
                        {formatDateTime(charge.last_notification.created_at)}
                      </small>
                    )}
                  </td>
                  <td>
                    {charge.paid_via === 'manual' && <span className="badge warning">Manual</span>}
                    {charge.paid_via === 'gateway' && <span className="badge success">Automático</span>}
                    {charge.status === 'paid' && !charge.paid_via && <span className="badge success">Pago</span>}
                    {charge.status !== 'paid' && '—'}
                  </td>
                  <td className="actions">
                    {charge.invoice_url && (
                      <a href={charge.invoice_url} target="_blank" rel="noreferrer" className="btn-sm btn-secondary">Link</a>
                    )}
                    {canManualPay && (
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => {
                          setManualPayment(charge);
                          setManualNotes('');
                          setManualNotify(true);
                        }}
                      >
                        Baixa manual
                      </button>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {manualPayment && (
        <form className="form-card" onSubmit={handleManualPayment}>
          <h3>Baixa manual — {manualPayment.description}</h3>
          <p className="muted">
            {manualPayment.user_name || manualPayment.user_email} · {formatMoney(manualPayment.amount)} · venc. {formatDate(manualPayment.due_date)}
          </p>
          <label>
            Observações (opcional)
            <input
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Ex.: Pago em dinheiro na loja"
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={manualNotify}
              onChange={(e) => setManualNotify(e.target.checked)}
            />
            Enviar mensagem de pagamento recebido (WhatsApp / SMS conforme configuração)
          </label>
          <div className="form-actions">
            <button type="submit" disabled={submittingManual}>
              {submittingManual ? 'Registrando...' : 'Confirmar baixa manual'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setManualPayment(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="section-header" style={{ marginTop: '1.5rem' }}>
        <SectionTitleWithHelp title="Histórico de lembretes (WhatsApp / SMS)" guideId="financeiro" />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Cobrança</th>
              <th>Canal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {billingNotifications.length === 0 ? (
              <tr><td colSpan={5} className="muted">Nenhum lembrete registrado ainda.</td></tr>
            ) : (
              billingNotifications.map((item) => {
                const notify = notificationBadge(item);
                return (
                  <tr key={item.id}>
                    <td><small>{formatDateTime(item.created_at)}</small></td>
                    <td>{item.user_name || item.user_email || item.phone}</td>
                    <td>{item.invoice_description || `#${item.invoice_id || '—'}`}</td>
                    <td>
                      <span className={`badge ${notify.badge}`}>{notify.label}</span>
                      {item.provider_type && (
                        <small className="muted" style={{ display: 'block' }}>{item.provider_type}</small>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${item.status === 'failed' ? 'error' : 'success'}`}>
                        {item.status}
                      </span>
                      {item.error_message && item.status === 'failed' && (
                        <small className="muted" style={{ display: 'block' }}>{item.error_message}</small>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
