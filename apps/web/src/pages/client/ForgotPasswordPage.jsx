import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
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
      const res = await api.requestPasswordReset(email);
      setSent(true);
      setMessage(res.data?.message || 'Verifique seu WhatsApp.');
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
          <p>Enviaremos um código de 6 dígitos no WhatsApp cadastrado.</p>
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
