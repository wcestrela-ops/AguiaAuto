import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

const EMPTY_FORM = {
  gpswox_device_id: '',
  gpswox_name: '',
  imei: '',
  notes: '',
  report: '',
  duration_minutes: '',
  create_in_gpswox: true,
};

const MAX_PHOTOS = 3;

export default function InstallerJobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [job, setJob] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState([]);
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

  useEffect(() => () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }, [photos]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const available = MAX_PHOTOS - photos.length;
    if (available <= 0) {
      setError(`Máximo de ${MAX_PHOTOS} fotos.`);
      return;
    }

    const selected = files.slice(0, available).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...selected]);
    setError('');
    e.target.value = '';
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('gpswox_device_id', form.gpswox_device_id.trim());
      if (form.gpswox_name.trim()) formData.append('gpswox_name', form.gpswox_name.trim());
      if (form.imei.trim()) formData.append('imei', form.imei.trim());
      if (form.notes.trim()) formData.append('notes', form.notes.trim());
      formData.append('report', form.report.trim());
      formData.append('duration_minutes', form.duration_minutes);
      formData.append('create_in_gpswox', String(form.create_in_gpswox));
      photos.forEach((photo) => formData.append('photos', photo.file));

      await api.finalizeInstallation(id, formData);
      setMessage('Instalação finalizada. O cliente receberá o relatório em Contratos.');
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
        <p>Finalizar instalação, registrar relatório e enviar ao cliente.</p>
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

      <form className="card form-card installer-report-form" onSubmit={handleSubmit}>
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
          Duração da instalação (minutos) *
          <input
            type="number"
            min="1"
            max="1440"
            value={form.duration_minutes}
            onChange={(e) => updateForm('duration_minutes', e.target.value)}
            placeholder="Ex: 45"
            required
          />
        </label>

        <label>
          Relatório da instalação *
          <textarea
            value={form.report}
            onChange={(e) => updateForm('report', e.target.value)}
            rows={4}
            placeholder="Descreva como foi a instalação, local do equipamento, testes realizados..."
            required
          />
        </label>

        <label>
          Observações internas
          <textarea
            value={form.notes}
            onChange={(e) => updateForm('notes', e.target.value)}
            rows={2}
            placeholder="Anotações adicionais (opcional)"
          />
        </label>

        <div className="photo-upload-block">
          <div className="section-header">
            <label>Fotos da instalação (máx. {MAX_PHOTOS})</label>
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Adicionar foto
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={handlePhotoSelect}
          />
          {photos.length > 0 ? (
            <div className="photo-grid">
              {photos.map((photo, index) => (
                <div key={photo.preview} className="photo-thumb">
                  <img src={photo.preview} alt={`Foto ${index + 1}`} />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => removePhoto(index)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhuma foto adicionada.</p>
          )}
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.create_in_gpswox}
            onChange={(e) => updateForm('create_in_gpswox', e.target.checked)}
          />
          Criar veículo automaticamente no GPSWOX
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Finalizando...' : 'Finalizar e enviar relatório'}
        </button>
      </form>
    </div>
  );
}
