import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function ClientProfilePage() {
  const [profile, setProfile] = useState({ name: '', phone: '', email: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPerfil()
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err.message));
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await api.updatePerfil({ name: profile.name, phone: profile.phone });
      setProfile(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setMessage('Perfil atualizado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.changePassword(passwords.current_password, passwords.new_password);
      setMessage('Senha alterada. Faça login novamente.');
      setPasswords({ current_password: '', new_password: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie seus dados e senha.</p>
      </header>

      <form className="form-card" onSubmit={saveProfile}>
        <h3>Dados pessoais</h3>
        <label>E-mail<input value={profile.email || ''} disabled /></label>
        <label>Nome<input value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
        <label>Telefone<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
        <button type="submit">Salvar perfil</button>
      </form>

      <form className="form-card" onSubmit={savePassword}>
        <h3>Alterar senha</h3>
        <label>Senha atual<input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></label>
        <label>Nova senha<input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} minLength={6} /></label>
        <button type="submit">Alterar senha</button>
      </form>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
    </div>
  );
}
