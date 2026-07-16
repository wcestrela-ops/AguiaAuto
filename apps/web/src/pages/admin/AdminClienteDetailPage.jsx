import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';
import {
  financialStatusBadge,
  financialStatusLabel,
  provisioningStatusBadge,
  provisioningStatusLabel,
} from '../../utils/clients';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const INVOICE_STATUS_LABELS = {
  pending: 'Pendente',
  overdue: 'Vencida',
  paid: 'Paga',
  cancelled: 'Cancelada',
};

export default function AdminClienteDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprovisioning, setReprovisioning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminClientDetail(id);
      setDetail(res.data);
      setForm({
        name: res.data?.user?.name || '',
        phone: res.data?.user?.phone || '',
        active: res.data?.user?.active !== false,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateAdminClient(id, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        active: form.active,
      });
      setMessage('Cliente atualizado.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReprovision() {
    setReprovisioning(true);
    setMessage('');
    setError('');
    try {
      const res = await api.reprovisionUser(id);
      setMessage(`Provisionamento: ${res.data?.status || 'concluído'}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReprovisioning(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (!detail) return <div className="alert error">{error || 'Cliente não encontrado.'}</div>;

  const { user, resumo_financeiro: resumo, veiculos, faturas_recentes: faturas, assinatura, indicacoes, push_devices: pushDevices } = detail;

  return (
    <div>
      <PageHeaderWithHelp
        title={user.name || user.email}
        subtitle={`Cliente #${user.id} · ${user.email}`}
        guideId="admin_clientes"
      >
        <Link to="/admin/clientes" className="btn-secondary" style={{ padding: '0.625rem 1rem', borderRadius: '8px' }}>
          Voltar
        </Link>
        <Link to="/admin/financeiro" className="btn-secondary" style={{ padding: '0.625rem 1rem', borderRadius: '8px' }}>
          Financeiro
        </Link>
      </PageHeaderWithHelp>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="client-detail-grid">
        <section className="form-card">
          <SectionTitleWithHelp title="Cadastro" guideId="admin_clientes" />
          <form onSubmit={handleSave}>
            <label>
              Nome
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label>
              Telefone
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Conta ativa (desmarque para bloquear acesso)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>

          <div className="info-box" style={{ marginTop: '1rem' }}>
            <div>CPF/CNPJ: <strong>{user.cpf_cnpj || '—'}</strong></div>
            <div>Cadastro: {formatDateTime(user.created_at)}</div>
            <div>Push: {pushDevices} dispositivo(s)</div>
            {indicacoes.codigo && <div>Código indicação: <strong>{indicacoes.codigo}</strong></div>}
          </div>
        </section>

        <section className="form-card">
          <SectionTitleWithHelp title="Provisionamento" guideId="admin_clientes" />
          <div className="info-box">
            <div>
              Status:{' '}
              <span className={`badge ${provisioningStatusBadge(user.provisioning_status)}`}>
                {provisioningStatusLabel(user.provisioning_status)}
              </span>
            </div>
            <div>Asaas: {user.asaas_customer_id || '—'}</div>
            <div>Mercado Pago: {user.mercadopago_payer_id || '—'}</div>
            <div>GPSWOX: {user.gpswox_user_id || '—'}</div>
            {user.provisioning_errors && (
              <pre className="audit-json">{JSON.stringify(user.provisioning_errors, null, 2)}</pre>
            )}
          </div>
          <button type="button" onClick={handleReprovision} disabled={reprovisioning}>
            {reprovisioning ? 'Reprovisionando...' : 'Reprovisionar Asaas + GPSWOX'}
          </button>
        </section>

        <section className="form-card">
          <SectionTitleWithHelp title="Financeiro" guideId="admin_clientes" />
          <div className="info-box">
            <div>
              Situação:{' '}
              <span className={`badge ${financialStatusBadge(resumo?.status)}`}>
                {financialStatusLabel(resumo?.status)}
              </span>
            </div>
            {assinatura && (
              <div>Plano: <strong>{assinatura.plan_name}</strong> — {formatMoney(assinatura.price_monthly)}/mês</div>
            )}
            {resumo?.proximo_vencimento && (
              <div>
                Próximo vencimento: {formatDate(resumo.proximo_vencimento)}
                {resumo.proximo_valor != null ? ` · ${formatMoney(resumo.proximo_valor)}` : ''}
              </div>
            )}
            <div>Faturas pendentes/atrasadas: {resumo?.faturas_pendentes || 0}</div>
          </div>
        </section>

        <section className="form-card">
          <SectionTitleWithHelp title="Indicações" guideId="admin_clientes" />
          <div className="info-box">
            <div>Indicações feitas: {indicacoes.feitas}</div>
            {indicacoes.indicado_por && (
              <div>Indicado por código: {indicacoes.indicado_por.referral_code}</div>
            )}
            {indicacoes.lista.length === 0 ? (
              <p className="muted">Nenhuma indicação registrada.</p>
            ) : (
              <ul className="client-inline-list">
                {indicacoes.lista.map((item) => (
                  <li key={item.id}>
                    {item.referred_name || item.referred_email} — {item.discount_status}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {indicacoes.feitas > 0 && (
            <Link to="/admin/indicacoes" className="btn-ghost btn-sm">Ver painel Indique e Ganhe</Link>
          )}
        </section>
      </div>

      <div className="table-card" style={{ marginTop: '1.5rem' }}>
        <SectionTitleWithHelp title="Veículos" guideId="admin_clientes" />
        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Status</th>
              <th>Chip SMS</th>
              <th>GPSWOX</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.length === 0 ? (
              <tr><td colSpan={5} className="muted">Nenhum veículo cadastrado.</td></tr>
            ) : (
              veiculos.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><strong>{vehicle.plate}</strong></td>
                  <td>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                  <td>
                    <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
                      {vehicleStatusLabel(vehicle.status)}
                    </span>
                  </td>
                  <td>{vehicle.tracker_phone || '—'}</td>
                  <td>{vehicle.gpswox_device_id || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ padding: '0.75rem 1rem' }}>
          <Link to="/admin/veiculos" className="btn-ghost btn-sm">Gerenciar veículos</Link>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: '1.5rem' }}>
        <SectionTitleWithHelp title="Faturas recentes" guideId="admin_clientes" />
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Gateway</th>
            </tr>
          </thead>
          <tbody>
            {faturas.length === 0 ? (
              <tr><td colSpan={5} className="muted">Nenhuma fatura registrada.</td></tr>
            ) : (
              faturas.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.description}</td>
                  <td>{formatMoney(invoice.amount)}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>{INVOICE_STATUS_LABELS[invoice.status] || invoice.status}</td>
                  <td>{invoice.payment_provider || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
