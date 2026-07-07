import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const STATUS_LABELS = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  refunded: 'Estornado',
};

const STATUS_BADGE = {
  pending: 'warning',
  paid: 'success',
  overdue: 'error',
  refunded: 'info',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function ClientFinanceiroPage() {
  const [resumo, setResumo] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [mensalidades, setMensalidades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [resumoRes, faturasRes, mensRes] = await Promise.all([
        api.getFinanceiroResumo(),
        api.getFinanceiroFaturas(),
        api.getFinanceiroMensalidades(),
      ]);
      setResumo(resumoRes.data);
      setFaturas(faturasRes.data || []);
      setMensalidades(mensRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSegundaVia(invoiceId) {
    setMessage('');
    setError('');
    try {
      const res = await api.segundaViaFatura(invoiceId);
      setMessage('Link de pagamento atualizado.');
      setFaturas((prev) => prev.map((f) => (f.id === invoiceId ? res.data : f)));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando financeiro...</p>;

  const situacaoLabel = {
    em_dia: 'Em dia',
    atrasado: 'Em atraso',
    sem_cobranca: 'Sem cobranças',
  };

  return (
    <div>
      <header className="page-header">
        <h1>Financeiro</h1>
        <p>Mensalidades, faturas e links de pagamento.</p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {resumo && (
        <div className="card-grid">
          <div className="card">
            <span className="card-icon">💳</span>
            <h3>Situação</h3>
            <p>
              <span className={`badge ${resumo.status === 'atrasado' ? 'error' : 'success'}`}>
                {situacaoLabel[resumo.status] || resumo.status}
              </span>
            </p>
          </div>
          <div className="card">
            <span className="card-icon">📅</span>
            <h3>Próximo vencimento</h3>
            <p>{formatDate(resumo.proximo_vencimento)}</p>
            {resumo.proximo_valor != null && (
              <small className="muted">{formatMoney(resumo.proximo_valor)}</small>
            )}
          </div>
          {resumo.plano && (
            <div className="card">
              <span className="card-icon">📦</span>
              <h3>Plano</h3>
              <p>{resumo.plano.nome}</p>
              <small className="muted">{formatMoney(resumo.plano.valor_mensal)}/mês</small>
            </div>
          )}
        </div>
      )}

      {mensalidades?.ativa && (
        <div className="info-box">
          Assinatura ativa: <strong>{mensalidades.assinatura.plano}</strong> —{' '}
          {formatMoney(mensalidades.assinatura.valor)}/mês
        </div>
      )}

      <section className="dashboard-section">
        <div className="section-header">
          <h2>Faturas</h2>
        </div>

        {faturas.length === 0 ? (
          <div className="info-box">Nenhuma fatura encontrada.</div>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((fatura) => (
                  <tr key={fatura.id}>
                    <td>{fatura.description || 'Mensalidade'}</td>
                    <td>{formatMoney(fatura.amount)}</td>
                    <td>{formatDate(fatura.due_date)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[fatura.status] || 'info'}`}>
                        {STATUS_LABELS[fatura.status] || fatura.status}
                      </span>
                    </td>
                    <td className="actions">
                      {fatura.status !== 'paid' && fatura.invoice_url && (
                        <a href={fatura.invoice_url} target="_blank" rel="noreferrer" className="btn-sm btn-secondary">
                          Pagar
                        </a>
                      )}
                      {fatura.status !== 'paid' && (
                        <button
                          type="button"
                          className="btn-sm"
                          onClick={() => handleSegundaVia(fatura.id)}
                        >
                          2ª via
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted text-center">
        Dúvidas? <Link to="/app/perfil">Entre em contato pelo perfil</Link>.
      </p>
    </div>
  );
}
