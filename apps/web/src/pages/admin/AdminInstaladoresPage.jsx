import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const EMPTY_FORM = {
  email: '',
  password: '',
  name: '',
  phone: '',
};

export default function AdminInstaladoresPage() {
  const [installers, setInstallers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getAdminInstallers();
      setInstallers(res.data || []);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await api.createAdminInstaller(form);
      setMessage('Instalador criado com sucesso.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>Instaladores</h1>
          <p>Contas com acesso à área de instalação de rastreadores.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Novo instalador'}
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showForm && (
        <form className="card form-card" onSubmit={handleSubmit}>
          <h3>Cadastrar instalador</h3>

          <label>
            Nome
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
            />
          </label>

          <label>
            E-mail *
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              required
            />
          </label>

          <label>
            Senha *
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              required
              minLength={6}
            />
          </label>

          <label>
            Telefone
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm('phone', e.target.value)}
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Criar instalador'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {installers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">Nenhum instalador cadastrado.</td>
                </tr>
              ) : (
                installers.map((installer) => (
                  <tr key={installer.id}>
                    <td>{installer.name || '—'}</td>
                    <td>{installer.email}</td>
                    <td>{installer.phone || '—'}</td>
                    <td>{new Date(installer.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
