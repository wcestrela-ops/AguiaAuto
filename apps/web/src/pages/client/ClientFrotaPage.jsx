import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { setClientPageError } from '../../utils/client-api-error';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';
import { fleetStatusBadgeClass, fleetStatusLabel } from '../../utils/fleet';

const EMPTY_DOC = {
  vehicle_id: '',
  doc_type: 'crlv',
  title: '',
  expiry_date: '',
  notes: '',
};

const EMPTY_MAINT = {
  vehicle_id: '',
  service_type: 'revisao',
  title: '',
  performed_at: '',
  odometer_km: '',
  cost: '',
  next_due_date: '',
  next_due_km: '',
  notes: '',
};

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function docToForm(doc) {
  return {
    vehicle_id: String(doc.vehicle_id || ''),
    doc_type: doc.doc_type || 'crlv',
    title: doc.title || '',
    expiry_date: toDateInput(doc.expiry_date),
    notes: doc.notes || '',
  };
}

function maintToForm(item) {
  return {
    vehicle_id: String(item.vehicle_id || ''),
    service_type: item.service_type || 'revisao',
    title: item.title || '',
    performed_at: toDateInput(item.performed_at),
    odometer_km: item.odometer_km != null ? String(item.odometer_km) : '',
    cost: item.cost != null ? String(item.cost) : '',
    next_due_date: toDateInput(item.next_due_date),
    next_due_km: item.next_due_km != null ? String(item.next_due_km) : '',
    notes: item.notes || '',
  };
}

export default function ClientFrotaPage() {
  const [tab, setTab] = useState('documentos');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDocForm, setShowDocForm] = useState(false);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingMaintId, setEditingMaintId] = useState(null);
  const [editingDocHasFile, setEditingDocHasFile] = useState(false);
  const [editingDocFilename, setEditingDocFilename] = useState('');
  const [docForm, setDocForm] = useState(EMPTY_DOC);
  const [docFile, setDocFile] = useState(null);
  const [maintForm, setMaintForm] = useState(EMPTY_MAINT);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFrotaOverview();
      setOverview(res.data);
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreateDocument() {
    setEditingDocId(null);
    setEditingDocHasFile(false);
    setEditingDocFilename('');
    setDocForm(EMPTY_DOC);
    setDocFile(null);
    setShowDocForm(true);
  }

  function openEditDocument(doc) {
    setEditingDocId(doc.id);
    setEditingDocHasFile(Boolean(doc.has_file));
    setEditingDocFilename(doc.original_filename || '');
    setDocForm(docToForm(doc));
    setDocFile(null);
    setShowDocForm(true);
  }

  function closeDocumentForm() {
    setShowDocForm(false);
    setEditingDocId(null);
    setEditingDocHasFile(false);
    setEditingDocFilename('');
    setDocForm(EMPTY_DOC);
    setDocFile(null);
  }

  function openCreateMaintenance() {
    setEditingMaintId(null);
    setMaintForm(EMPTY_MAINT);
    setShowMaintForm(true);
  }

  function openEditMaintenance(item) {
    setEditingMaintId(item.id);
    setMaintForm(maintToForm(item));
    setShowMaintForm(true);
  }

  function closeMaintenanceForm() {
    setShowMaintForm(false);
    setEditingMaintId(null);
    setMaintForm(EMPTY_MAINT);
  }

  async function openDocumentFile(id) {
    setError('');
    try {
      await api.openFrotaDocumentFile(id);
    } catch (err) {
      setClientPageError(setError, err);
    }
  }

  async function submitDocument(e) {
    e.preventDefault();
    if (!docForm.vehicle_id) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('doc_type', docForm.doc_type);
      formData.append('title', docForm.title);
      if (docForm.expiry_date) formData.append('expiry_date', docForm.expiry_date);
      if (docForm.notes) formData.append('notes', docForm.notes);
      if (docFile) formData.append('file', docFile);

      if (editingDocId) {
        formData.append('vehicle_id', docForm.vehicle_id);
        await api.updateFrotaDocument(editingDocId, formData);
        setMessage('Documento atualizado.');
      } else {
        await api.createFrotaDocument(docForm.vehicle_id, formData);
        setMessage('Documento cadastrado.');
      }

      closeDocumentForm();
      await load();
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMaintenance(e) {
    e.preventDefault();
    if (!maintForm.vehicle_id) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        service_type: maintForm.service_type,
        title: maintForm.title,
        performed_at: maintForm.performed_at,
        odometer_km: maintForm.odometer_km || undefined,
        cost: maintForm.cost || undefined,
        next_due_date: maintForm.next_due_date || undefined,
        next_due_km: maintForm.next_due_km || undefined,
        notes: maintForm.notes || undefined,
      };

      if (editingMaintId) {
        await api.updateFrotaMaintenance(editingMaintId, payload);
        setMessage('Manutenção atualizada.');
      } else {
        await api.createFrotaMaintenance(maintForm.vehicle_id, payload);
        setMessage('Manutenção registrada.');
      }

      closeMaintenanceForm();
      await load();
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDocument(id) {
    if (!window.confirm('Excluir este documento?')) return;
    setError('');
    try {
      await api.deleteFrotaDocument(id);
      setMessage('Documento removido.');
      if (editingDocId === id) closeDocumentForm();
      await load();
    } catch (err) {
      setClientPageError(setError, err);
    }
  }

  async function removeMaintenance(id) {
    if (!window.confirm('Excluir este registro?')) return;
    setError('');
    try {
      await api.deleteFrotaMaintenance(id);
      setMessage('Registro removido.');
      if (editingMaintId === id) closeMaintenanceForm();
      await load();
    } catch (err) {
      setClientPageError(setError, err);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  const resumo = overview?.resumo || {};
  const docTypes = overview?.doc_types || [];
  const maintTypes = overview?.maintenance_types || [];
  const veiculos = overview?.veiculos || [];

  return (
    <div>
      <PageHeaderWithHelp
        title="Documentos e Manutenção"
        subtitle="CRLV, seguro, IPVA e histórico de revisões dos seus veículos."
        guideId="client_frota"
        scope="client"
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="card-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="card">
          <h3>Documentos</h3>
          <p>{resumo.documentos_total || 0} cadastrados</p>
          {(resumo.documentos_vencidos > 0 || resumo.documentos_vencendo > 0) && (
            <small className="badge warning">
              {resumo.documentos_vencidos} vencido(s) · {resumo.documentos_vencendo} vencendo
            </small>
          )}
        </div>
        <div className="card">
          <h3>Manutenções</h3>
          <p>{resumo.manutencoes_total || 0} registros</p>
          {(resumo.manutencoes_atrasadas > 0 || resumo.manutencoes_proximas > 0) && (
            <small className="badge warning">
              {resumo.manutencoes_atrasadas} atrasada(s) · {resumo.manutencoes_proximas} próxima(s)
            </small>
          )}
        </div>
      </div>

      <div className="tab-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={tab === 'documentos' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('documentos')}
        >
          Documentos
        </button>
        <button
          type="button"
          className={tab === 'manutencao' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('manutencao')}
        >
          Manutenção
        </button>
      </div>

      {tab === 'documentos' && (
        <section>
          <div className="section-header">
            <SectionTitleWithHelp title="Documentos do veículo" guideId="client_frota_docs" scope="client" />
            <button type="button" onClick={() => (showDocForm && !editingDocId ? closeDocumentForm() : openCreateDocument())}>
              {showDocForm && !editingDocId ? 'Cancelar' : 'Novo documento'}
            </button>
          </div>

          {showDocForm && (
            <form className="form-card" onSubmit={submitDocument}>
              <h4>{editingDocId ? 'Editar documento' : 'Novo documento'}</h4>
              <label>
                Veículo
                <select
                  value={docForm.vehicle_id}
                  onChange={(e) => setDocForm((p) => ({ ...p, vehicle_id: e.target.value }))}
                  required
                  disabled={Boolean(editingDocId)}
                >
                  <option value="">Selecione</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={docForm.doc_type}
                  onChange={(e) => setDocForm((p) => ({ ...p, doc_type: e.target.value }))}
                >
                  {docTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  type="text"
                  value={docForm.title}
                  onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex.: CRLV 2026"
                  required
                />
              </label>
              <label>
                Vencimento
                <input
                  type="date"
                  value={docForm.expiry_date}
                  onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))}
                />
              </label>
              <label>
                Anexo (PDF ou imagem)
                <input type="file" accept=".pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                {editingDocId && editingDocHasFile && !docFile && (
                  <small className="muted" style={{ display: 'block', marginTop: '0.35rem' }}>
                    Anexo atual: {editingDocFilename || 'arquivo'}
                    {' · '}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openDocumentFile(editingDocId)}>
                      Ver anexo
                    </button>
                    {' · '}envie um novo arquivo para substituir
                  </small>
                )}
              </label>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={docForm.notes}
                  onChange={(e) => setDocForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingDocId ? 'Salvar alterações' : 'Salvar documento'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeDocumentForm}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="table-card">
            {(overview?.documentos || []).length === 0 ? (
              <p className="muted">Nenhum documento cadastrado.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview.documentos.map((doc) => (
                    <tr key={doc.id}>
                      <td>{[doc.brand, doc.model, doc.plate].filter(Boolean).join(' · ')}</td>
                      <td>{doc.doc_type_label}</td>
                      <td>{doc.title}</td>
                      <td>{doc.expiry_date_br || '—'}</td>
                      <td>
                        <span className={`badge ${fleetStatusBadgeClass(doc.expiry_status)}`}>
                          {fleetStatusLabel(doc.expiry_status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {doc.has_file && (
                            <button type="button" className="btn-ghost btn-sm" onClick={() => openDocumentFile(doc.id)}>
                              Ver arquivo
                            </button>
                          )}
                          <button type="button" className="btn-ghost btn-sm" onClick={() => openEditDocument(doc)}>
                            Editar
                          </button>
                          <button type="button" className="btn-ghost btn-sm" onClick={() => removeDocument(doc.id)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === 'manutencao' && (
        <section>
          <div className="section-header">
            <SectionTitleWithHelp title="Histórico de manutenção" guideId="client_frota_maint" scope="client" />
            <button type="button" onClick={() => (showMaintForm && !editingMaintId ? closeMaintenanceForm() : openCreateMaintenance())}>
              {showMaintForm && !editingMaintId ? 'Cancelar' : 'Registrar manutenção'}
            </button>
          </div>

          {showMaintForm && (
            <form className="form-card" onSubmit={submitMaintenance}>
              <h4>{editingMaintId ? 'Editar manutenção' : 'Nova manutenção'}</h4>
              <label>
                Veículo
                <select
                  value={maintForm.vehicle_id}
                  onChange={(e) => setMaintForm((p) => ({ ...p, vehicle_id: e.target.value }))}
                  required
                  disabled={Boolean(editingMaintId)}
                >
                  <option value="">Selecione</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={maintForm.service_type}
                  onChange={(e) => setMaintForm((p) => ({ ...p, service_type: e.target.value }))}
                >
                  {maintTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  type="text"
                  value={maintForm.title}
                  onChange={(e) => setMaintForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </label>
              <label>
                Data realizada
                <input
                  type="date"
                  value={maintForm.performed_at}
                  onChange={(e) => setMaintForm((p) => ({ ...p, performed_at: e.target.value }))}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  KM odômetro
                  <input
                    type="number"
                    value={maintForm.odometer_km}
                    onChange={(e) => setMaintForm((p) => ({ ...p, odometer_km: e.target.value }))}
                  />
                </label>
                <label>
                  Custo (R$)
                  <input
                    type="number"
                    step="0.01"
                    value={maintForm.cost}
                    onChange={(e) => setMaintForm((p) => ({ ...p, cost: e.target.value }))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Próxima revisão (data)
                  <input
                    type="date"
                    value={maintForm.next_due_date}
                    onChange={(e) => setMaintForm((p) => ({ ...p, next_due_date: e.target.value }))}
                  />
                </label>
                <label>
                  Próxima revisão (KM)
                  <input
                    type="number"
                    value={maintForm.next_due_km}
                    onChange={(e) => setMaintForm((p) => ({ ...p, next_due_km: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={maintForm.notes}
                  onChange={(e) => setMaintForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingMaintId ? 'Salvar alterações' : 'Salvar manutenção'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeMaintenanceForm}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="table-card">
            {(overview?.manutencoes || []).length === 0 ? (
              <p className="muted">Nenhuma manutenção registrada.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Serviço</th>
                    <th>Realizada</th>
                    <th>Próxima</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview.manutencoes.map((item) => (
                    <tr key={item.id}>
                      <td>{[item.brand, item.model, item.plate].filter(Boolean).join(' · ')}</td>
                      <td>{item.title}</td>
                      <td>{item.performed_at_br}</td>
                      <td>{item.next_due_date_br || '—'}</td>
                      <td>
                        {item.next_due_date ? (
                          <span className={`badge ${fleetStatusBadgeClass(item.due_status)}`}>
                            {fleetStatusLabel(item.due_status)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-ghost btn-sm" onClick={() => openEditMaintenance(item)}>
                            Editar
                          </button>
                          <button type="button" className="btn-ghost btn-sm" onClick={() => removeMaintenance(item.id)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
