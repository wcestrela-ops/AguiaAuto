import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeaderWithHelp } from '../../components/HelpGuide';
import { fleetStatusBadgeClass, fleetStatusLabel } from '../../utils/fleet';

const DOC_TYPES = [
  { key: 'crlv', label: 'CRLV' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'ipva', label: 'IPVA' },
  { key: 'licenciamento', label: 'Licenciamento' },
  { key: 'outro', label: 'Outro' },
];

const MAINT_TYPES = [
  { key: 'oleo', label: 'Troca de óleo' },
  { key: 'revisao', label: 'Revisão geral' },
  { key: 'pneus', label: 'Pneus' },
  { key: 'freios', label: 'Freios' },
  { key: 'bateria', label: 'Bateria' },
  { key: 'outro', label: 'Outro' },
];

export default function AdminFrotaPage() {
  const [tab, setTab] = useState('documentos');
  const [documents, setDocuments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDocForm, setShowDocForm] = useState(false);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [docForm, setDocForm] = useState({ vehicle_id: '', doc_type: 'crlv', title: '', expiry_date: '', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [maintForm, setMaintForm] = useState({
    vehicle_id: '', service_type: 'revisao', title: '', performed_at: '', next_due_date: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [docsRes, maintRes, vehiclesRes] = await Promise.all([
        api.getAdminFrotaDocuments(),
        api.getAdminFrotaMaintenance(),
        api.getAdminVehicles(),
      ]);
      setDocuments(docsRes.data || []);
      setMaintenance(maintRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitDocument(e) {
    e.preventDefault();
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
      await api.createAdminFrotaDocument(docForm.vehicle_id, formData);
      setMessage('Documento cadastrado.');
      setShowDocForm(false);
      setDocFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMaintenance(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.createAdminFrotaMaintenance(maintForm);
      setMessage('Manutenção registrada.');
      setShowMaintForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <PageHeaderWithHelp
        title="Documentos e Manutenção"
        subtitle="Gestão centralizada de CRLV, seguro e revisões por veículo."
        guideId="admin_frota"
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="tab-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className={tab === 'documentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('documentos')}>
          Documentos ({documents.length})
        </button>
        <button type="button" className={tab === 'manutencao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('manutencao')}>
          Manutenção ({maintenance.length})
        </button>
      </div>

      {tab === 'documentos' && (
        <>
          <div className="section-header">
            <h3>Documentos</h3>
            <button type="button" onClick={() => setShowDocForm((v) => !v)}>
              {showDocForm ? 'Cancelar' : 'Novo documento'}
            </button>
          </div>

          {showDocForm && (
            <form className="form-card" onSubmit={submitDocument}>
              <label>
                Veículo
                <select value={docForm.vehicle_id} onChange={(e) => setDocForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                  <option value="">Selecione</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.plate, v.user_name || v.user_email].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={docForm.doc_type} onChange={(e) => setDocForm((p) => ({ ...p, doc_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Título
                <input type="text" value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} required />
              </label>
              <label>
                Vencimento
                <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))} />
              </label>
              <label>
                Anexo
                <input type="file" accept=".pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              </label>
              <button type="submit" disabled={submitting}>Salvar</button>
            </form>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Veículo</th><th>Tipo</th><th>Título</th><th>Vencimento</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.user_name || doc.user_email}</td>
                    <td>{doc.plate}</td>
                    <td>{doc.doc_type_label}</td>
                    <td>{doc.title}</td>
                    <td>{doc.expiry_date_br || '—'}</td>
                    <td>
                      <span className={`badge ${fleetStatusBadgeClass(doc.expiry_status)}`}>
                        {fleetStatusLabel(doc.expiry_status)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => api.deleteAdminFrotaDocument(doc.id).then(load)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'manutencao' && (
        <>
          <div className="section-header">
            <h3>Manutenções</h3>
            <button type="button" onClick={() => setShowMaintForm((v) => !v)}>
              {showMaintForm ? 'Cancelar' : 'Nova manutenção'}
            </button>
          </div>

          {showMaintForm && (
            <form className="form-card" onSubmit={submitMaintenance}>
              <label>
                Veículo
                <select value={maintForm.vehicle_id} onChange={(e) => setMaintForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                  <option value="">Selecione</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.plate, v.user_name || v.user_email].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={maintForm.service_type} onChange={(e) => setMaintForm((p) => ({ ...p, service_type: e.target.value }))}>
                  {MAINT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Título
                <input type="text" value={maintForm.title} onChange={(e) => setMaintForm((p) => ({ ...p, title: e.target.value }))} required />
              </label>
              <label>
                Data
                <input type="date" value={maintForm.performed_at} onChange={(e) => setMaintForm((p) => ({ ...p, performed_at: e.target.value }))} required />
              </label>
              <label>
                Próxima revisão
                <input type="date" value={maintForm.next_due_date} onChange={(e) => setMaintForm((p) => ({ ...p, next_due_date: e.target.value }))} />
              </label>
              <button type="submit" disabled={submitting}>Salvar</button>
            </form>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Veículo</th><th>Serviço</th><th>Realizada</th><th>Próxima</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {maintenance.map((item) => (
                  <tr key={item.id}>
                    <td>{item.user_name || item.user_email}</td>
                    <td>{item.plate}</td>
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
                      <button type="button" className="btn-ghost btn-sm" onClick={() => api.deleteAdminFrotaMaintenance(item.id).then(load)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
