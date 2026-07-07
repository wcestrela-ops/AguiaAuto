import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

const EMPTY_FORM = {
  gpswox_device_id: '',
  gpswox_name: '',
  imei: '',
  notes: '',
  create_in_gpswox: true,
};

export default function InstallerJobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getInstallerJob(id)
      .then((res) => {
        setJob(res.data);
        setForm((prev) => ({
          ...prev,
          gpswox_name: res.data?.plate || '',
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await api.finalizeInstallation(id, {
        gpswox_device_id: form.gpswox_device_id.trim(),
        gpswox_name: form.gpswox_name.trim() || undefined,
        imei: form.imei.trim() || undefined,
        notes: form.notes.trim() || undefined,
        create_in_gpswox: form.create_in_gpswox,
      });
      setMessage('Instalação finalizada. O cliente receberá uma notificação push.');
      setTimeout(() => navigate('/instalador/agendamentos'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (!job) return <div className="alert error">{error || 'Instalação não encontrada.'}</div>;

  return (
    <div>
      <header className="page-header">
        <p><Link to="/instalador/agendamentos">← Voltar aos agendamentos</Link></p>
        <h1>{job.label}</h1>
        <p>Finalizar instalação e ativar o rastreador.</p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="card-grid">
        <section className="card">
          <h3>Veículo</h3>
          <dl className="detail-list">
            <div><dt>Placa</dt><dd>{job.plate}</dd></div>
            <div><dt>Marca / Modelo</dt><dd>{[job.brand, job.model].filter(Boolean).join(' ') || '—'}</dd></div>
            <div><dt>Cor</dt><dd>{job.color || '—'}</dd></div>
            <div><dt>Ano</dt><dd>{job.year || '—'}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h3>Cliente</h3>
          <dl className="detail-list">
            <div><dt>Nome</dt><dd>{job.client?.name || '—'}</dd></div>
            <div><dt>E-mail</dt><dd>{job.client?.email || '—'}</dd></div>
            <div><dt>Telefone</dt><dd>{job.client?.phone || '—'}</dd></div>
          </dl>
        </section>
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        <h3>Dados do rastreador</h3>

        <label>
          Device ID GPSWOX *
          <input
            type="text"
            value={form.gpswox_device_id}
            onChange={(e) => updateForm('gpswox_device_id', e.target.value)}
            placeholder="ID do dispositivo no GPSWOX"
            required
          />
        </label>

        <label>
          Nome no GPSWOX
          <input
            type="text"
            value={form.gpswox_name}
            onChange={(e) => updateForm('gpswox_name', e.target.value)}
            placeholder={job.plate}
          />
        </label>

        <label>
          IMEI
          <input
            type="text"
            value={form.imei}
            onChange={(e) => updateForm('imei', e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <label>
          Observações
          <textarea
            value={form.notes}
            onChange={(e) => updateForm('notes', e.target.value)}
            rows={3}
            placeholder="Anotações da instalação"
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.create_in_gpswox}
            onChange={(e) => updateForm('create_in_gpswox', e.target.checked)}
          />
          Criar veículo automaticamente no GPSWOX
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Finalizando...' : 'Finalizar instalação'}
        </button>
      </form>
    </div>
  );
}
