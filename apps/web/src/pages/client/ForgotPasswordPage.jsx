import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const CHANNEL_OPTIONS = [
  {
    value: 'both',
    label: 'E-mail e WhatsApp',
    hint: 'Mesmo código nos dois canais (recomendado se você tem WhatsApp cadastrado).',
  },
  {
    value: 'email',
    label: 'Somente e-mail',
    hint: 'Ideal se você não usa WhatsApp ou prefere receber só por e-mail.',
  },
  {
    value: 'whatsapp',
    label: 'Somente WhatsApp',
    hint: 'Disponível apenas se houver WhatsApp cadastrado na conta.',
  },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState('both');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.requestPasswordReset(email, channel);
      setSent(true);
      setMessage(res.data?.message || 'Verifique seu e-mail e/ou WhatsApp.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-icon">🔑</span>
          <h1>Recuperar senha</h1>
          <p>Enviaremos um código de 6 dígitos. O mesmo código vale para todos os canais escolhidos.</p>
        </div>

        {!sent ? (
          <>
            <label>
              E-mail da conta
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>

            <fieldset className="channel-fieldset">
              <legend>Onde receber o código?</legend>
              {CHANNEL_OPTIONS.map((option) => (
                <label key={option.value} className="channel-option">
                  <input
                    type="radio"
                    name="channel"
                    value={option.value}
                    checked={channel === option.value}
                    onChange={(e) => setChannel(e.target.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small className="hint">{option.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {error && <div className="alert error">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </>
        ) : (
          <>
            <div className="alert success">{message}</div>
            <Link to={`/recuperar-senha/confirmar?email=${encodeURIComponent(email)}`} className="btn-link">
              <button type="button">Inserir código</button>
            </Link>
          </>
        )}

        <p className="text-center muted">
          <Link to="/login">← Voltar ao login</Link>
        </p>
      </form>
    </div>
  );
}
