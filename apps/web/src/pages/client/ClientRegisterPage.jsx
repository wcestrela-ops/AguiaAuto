import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';

const BILLING_TYPES = [
  { value: 'PIX', label: 'PIX (recomendado)' },
  { value: 'UNDEFINED', label: 'Escolher no pagamento' },
  { value: 'BOLETO', label: 'Boleto' },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function provisioningMessage(onboarding) {
  const status = onboarding?.provisioning?.status;
  if (status === 'completed') {
    return 'Conta criada! Pagamento, GPSWOX e contrato configurados automaticamente.';
  }
  if (status === 'partial') {
    return 'Conta criada. Alguns passos do provisionamento ficaram pendentes — nossa equipe pode ajudar.';
  }
  return 'Conta criada. Acompanhe cobrança e instalação pelo app.';
}

export default function ClientRegisterPage() {
  const [searchParams] = useSearchParams();
  const refFromUrl = (searchParams.get('ref') || '').trim().toUpperCase();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf_cnpj: '',
    password: '',
    plan_id: '',
    billing_type: 'PIX',
    referral_code: refFromUrl,
    plate: '',
    brand: '',
    model: '',
    accept_terms: false,
  });
  const [plans, setPlans] = useState([]);
  const [referralInfo, setReferralInfo] = useState(null);
  const [referralError, setReferralError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const planFromUrl = searchParams.get('plan');
    api.getPlans()
      .then((res) => {
        const list = res.data || [];
        setPlans(list);
        if (planFromUrl && list.some((p) => String(p.id) === planFromUrl)) {
          setForm((prev) => ({ ...prev, plan_id: planFromUrl }));
        } else if (list.length === 1) {
          setForm((prev) => ({ ...prev, plan_id: String(list[0].id) }));
        }
      })
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    if (!refFromUrl) return;

    api.validateReferralCode(refFromUrl)
      .then((res) => {
        if (res.data?.valido) {
          setReferralInfo(res.data);
          setReferralError('');
        } else {
          setReferralError(res.data?.motivo || 'Código de indicação inválido.');
        }
      })
      .catch((err) => setReferralError(err.message));
  }, [refFromUrl]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (plans.length === 0) {
        throw new Error('Cadastro online indisponível no momento. Entre em contato com a central.');
      }

      if (!form.accept_terms) {
        throw new Error('Aceite o Contrato de Prestação de Serviços para continuar.');
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        cpf_cnpj: form.cpf_cnpj.trim(),
        password: form.password,
        plan_id: Number(form.plan_id),
        billing_type: form.billing_type,
        referral_code: form.referral_code?.trim() || undefined,
        accept_terms: true,
        vehicle: {
          plate: form.plate.trim() || undefined,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
        },
      };

      const res = await api.onboardingRegister(payload);
      const onboarding = res.data?.onboarding;

      setMessage(provisioningMessage(onboarding));

      const target = onboarding?.next_path || await api.getClientAppPath();
      setTimeout(() => navigate(target), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card register-card" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-icon">🦅</span>
          <h1>Criar conta</h1>
          <p>Cadastro automatizado — plano, veículo, contrato e pagamento</p>
        </div>

        {referralInfo?.valido && (
          <div className="alert success">
            Você foi indicado por <strong>{referralInfo.indicador}</strong>.
            Código <code>{referralInfo.codigo}</code> aplicado automaticamente.
          </div>
        )}
        {referralError && <div className="alert warning">{referralError}</div>}

        <label>Nome<input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label>
        <label>E-mail<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
        <label>Telefone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} required placeholder="(85) 99999-9999" /></label>
        <label>CPF/CNPJ<input value={form.cpf_cnpj} onChange={(e) => update('cpf_cnpj', e.target.value)} required placeholder="Somente números ou formatado" /></label>

        <label>
          Código de indicação (opcional)
          <input
            value={form.referral_code}
            onChange={(e) => update('referral_code', e.target.value.toUpperCase())}
            placeholder="Ex.: AG3K9X2M"
            maxLength={12}
            readOnly={Boolean(refFromUrl && referralInfo?.valido)}
          />
        </label>

        {plans.length > 0 ? (
          <>
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
            </label>

            <label>
              Forma de pagamento inicial
              <select value={form.billing_type} onChange={(e) => update('billing_type', e.target.value)}>
                {BILLING_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="alert warning">Nenhum plano disponível para cadastro online.</div>
        )}

        <fieldset className="register-fieldset">
          <legend>Seu veículo</legend>
          <label>
            Placa (opcional)
            <input
              value={form.plate}
              onChange={(e) => update('plate', e.target.value.toUpperCase())}
              placeholder="ABC1D23 — deixe em branco se ainda não emplacou"
              maxLength={8}
            />
          </label>
          <div className="form-row">
            <label>
              Marca
              <input value={form.brand} onChange={(e) => update('brand', e.target.value)} placeholder="Ex.: Fiat" />
            </label>
            <label>
              Modelo
              <input value={form.model} onChange={(e) => update('model', e.target.value)} placeholder="Ex.: Argo" />
            </label>
          </div>
          <small className="hint">Veículos novos podem ser cadastrados sem placa. O veículo ficará aguardando instalação do rastreador. Você receberá push quando o técnico finalizar.</small>
        </fieldset>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.accept_terms}
            onChange={(e) => update('accept_terms', e.target.checked)}
            required
          />
          Li e aceito o Contrato de Prestação de Serviços e autorizo a cobrança do plano selecionado.
        </label>

        <label>Senha<input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={6} required /></label>
        <small className="hint">Enviaremos suas credenciais por e-mail. WhatsApp de boas-vindas se disponível.</small>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <button type="submit" disabled={loading || plans.length === 0}>
          {loading ? 'Cadastrando...' : 'Finalizar cadastro'}
        </button>

        <p className="text-center muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
