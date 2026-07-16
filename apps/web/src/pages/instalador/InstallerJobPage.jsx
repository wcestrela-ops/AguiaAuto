import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';
import { isValidImei, isValidTrackerPhone, normalizeImei } from '../../utils/imei';

const EMPTY_FORM = {
  plate: '',
  gpswox_device_id: '',
  gpswox_name: '',
  imei: '',
  tracker_phone: '',
  tracker_model_id: '',
  notes: '',
  report: '',
  duration_minutes: '',
  create_in_gpswox: true,
};

const MAX_PHOTOS = 3;
const MIN_REPORT_LENGTH = 20;

function ChecklistItem({ done, label }) {
  return (
    <li className={`installer-checklist-item${done ? ' done' : ''}`}>
      <span className="installer-checklist-mark" aria-hidden="true">{done ? '✓' : '○'}</span>
      {label}
    </li>
  );
}

export default function InstallerJobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [job, setJob] = useState(null);
  const [trackerModels, setTrackerModels] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [commTestOk, setCommTestOk] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.getInstallerJob(id),
      api.getInstallerTrackerModels(),
    ])
      .then(([jobRes, modelsRes]) => {
        const data = jobRes.data;
        setJob(data);
        setTrackerModels(modelsRes.data || []);
        const vehicle = data?.vehicle || {};
        setForm((prev) => ({
          ...prev,
          plate: data?.plate || '',
          gpswox_name: data?.plate || [data?.brand, data?.model].filter(Boolean).join(' ') || '',
          gpswox_device_id: vehicle.gpswox_device_id || data?.gpswox_device_id || '',
          imei: vehicle.tracker_imei || '',
          tracker_phone: vehicle.tracker_phone || '',
          tracker_model_id: vehicle.tracker_model_id ? String(vehicle.tracker_model_id) : '',
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }, [photos]);

  const checklist = useMemo(() => ({
    device: Boolean(form.gpswox_device_id.trim()),
    imei: isValidImei(form.imei),
    chip: isValidTrackerPhone(form.tracker_phone),
    model: Boolean(form.tracker_model_id),
    commTest: commTestOk,
    photos: photos.length >= 1,
    report: form.report.trim().length >= MIN_REPORT_LENGTH,
    duration: Number(form.duration_minutes) >= 1,
  }), [form, photos.length, commTestOk]);

  const checklistComplete = Object.values(checklist).every(Boolean);

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
    if (!checklistComplete) {
      setError('Complete todos os itens do checklist antes de finalizar.');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('gpswox_device_id', form.gpswox_device_id.trim());
      if (form.gpswox_name.trim()) formData.append('gpswox_name', form.gpswox_name.trim());
      if (form.plate.trim()) formData.append('plate', form.plate.trim());
      formData.append('imei', normalizeImei(form.imei));
      formData.append('tracker_phone', form.tracker_phone.trim());
      formData.append('tracker_model_id', form.tracker_model_id);
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
      <p><Link to="/instalador/agendamentos">← Voltar aos agendamentos</Link></p>
      <PageHeaderWithHelp
        title={job.label}
        subtitle="Finalizar instalação, registrar relatório e enviar ao cliente."
        guideId="installer_job"
        scope="installer"
        className="page-header"
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="card-grid">
        <section className="card">
          <h3>Veículo</h3>
          <dl className="detail-list">
            <div><dt>Placa</dt><dd>{job.plate || 'Sem placa'}</dd></div>
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
        <SectionTitleWithHelp title="Checklist de instalação" guideId="installer_job" scope="installer" />
        <ul className="installer-checklist">
          <ChecklistItem done={checklist.device} label="Device ID GPSWOX preenchido" />
          <ChecklistItem done={checklist.imei} label="IMEI válido (15 dígitos)" />
          <ChecklistItem done={checklist.chip} label="Chip SIM do rastreador registrado" />
          <ChecklistItem done={checklist.model} label="Modelo do rastreador selecionado" />
          <ChecklistItem done={checklist.commTest} label="Teste de posição/comunicação OK" />
          <ChecklistItem done={checklist.photos} label="Pelo menos 1 foto da instalação" />
          <ChecklistItem done={checklist.report} label={`Relatório com mínimo ${MIN_REPORT_LENGTH} caracteres`} />
          <ChecklistItem done={checklist.duration} label="Duração informada" />
        </ul>

        <label className="checkbox-row installer-comm-check">
          <input
            type="checkbox"
            checked={commTestOk}
            onChange={(e) => setCommTestOk(e.target.checked)}
          />
          Confirmo que testei comunicação ou posição do rastreador
        </label>

        <h3>Dados do rastreador</h3>

        {!job.plate && (
          <label>
            Placa do veículo
            <input
              type="text"
              value={form.plate}
              onChange={(e) => updateForm('plate', e.target.value.toUpperCase())}
              placeholder="Informe se o veículo já foi emplacado"
              maxLength={8}
            />
            <small className="field-hint">Opcional no cadastro — preencha aqui se o cliente ainda não tinha placa.</small>
          </label>
        )}

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
            placeholder={job.plate || 'Nome no GPSWOX'}
          />
        </label>

        <label>
          IMEI *
          <input
            type="text"
            inputMode="numeric"
            value={form.imei}
            onChange={(e) => updateForm('imei', e.target.value)}
            placeholder="15 dígitos na etiqueta do rastreador"
            required
          />
          {form.imei && !checklist.imei && (
            <small className="field-hint error">IMEI inválido — confira os 15 dígitos.</small>
          )}
        </label>

        <label>
          Chip SIM (número do rastreador) *
          <input
            type="tel"
            value={form.tracker_phone}
            onChange={(e) => updateForm('tracker_phone', e.target.value)}
            placeholder="5511999999999"
            required
          />
        </label>

        <label>
          Modelo do rastreador *
          <select
            value={form.tracker_model_id}
            onChange={(e) => updateForm('tracker_model_id', e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {trackerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}{model.manufacturer ? ` (${model.manufacturer})` : ''}
              </option>
            ))}
          </select>
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
            minLength={MIN_REPORT_LENGTH}
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
            <label>Fotos da instalação * (mín. 1, máx. {MAX_PHOTOS})</label>
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
            <p className="muted">Adicione ao menos uma foto do equipamento instalado.</p>
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

        <button type="submit" disabled={submitting || !checklistComplete}>
          {submitting ? 'Finalizando...' : checklistComplete ? 'Finalizar e enviar relatório' : 'Complete o checklist'}
        </button>
      </form>
    </div>
  );
}
