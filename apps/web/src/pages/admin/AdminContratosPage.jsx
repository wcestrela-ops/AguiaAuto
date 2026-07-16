import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { PageHeaderWithHelp } from '../../components/HelpGuide';

const TEMPLATE_LABELS = {
  'contrato-prestacao': 'Contrato de Prestação de Serviços',
  'termo-entrega-instalacao': 'Termo de Entrega e Instalação',
};

const ACCEPTANCE_LABELS = {
  service: 'Contrato de serviço',
  installation_delivery: 'Termo de entrega',
};

export default function AdminContratosPage() {
  const [tab, setTab] = useState('modelos');
  const [templates, setTemplates] = useState([]);
  const [aceites, setAceites] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body_html: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [templatesRes, aceitesRes] = await Promise.all([
        api.getAdminContractTemplates(),
        api.getAdminContractAcceptances(),
      ]);
      setTemplates(templatesRes.data || []);
      setAceites(aceitesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(template) {
    setEditing(template.slug);
    setForm({ title: template.title, body_html: template.body_html });
    setTab('modelos');
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateAdminContractTemplate(editing, form);
      setMessage('Modelo salvo. Novos aceites usarão a versão atualizada.');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadAcceptance(id) {
    try {
      await api.downloadAdminContractDocument(id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeaderWithHelp
        title="Contratos"
        subtitle="Edite os modelos e consulte os aceites assinados pelos clientes."
        guideId="admin_contratos"
      />

      <PageAlerts error={error} message={message} />

      <div className="tab-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn-secondary btn-sm${tab === 'modelos' ? ' active' : ''}`}
          onClick={() => setTab('modelos')}
        >
          Modelos
        </button>
        <button
          type="button"
          className={`btn-secondary btn-sm${tab === 'aceites' ? ' active' : ''}`}
          onClick={() => setTab('aceites')}
        >
          Aceites ({aceites.length})
        </button>
      </div>

      {loading ? (
        <p className="loading-placeholder">Carregando contratos...</p>
      ) : tab === 'modelos' ? (
        <div className="dashboard-grid">
          {templates.map((template) => (
            <section key={template.slug} className="card">
              <header className="section-header">
                <div>
                  <h3>{TEMPLATE_LABELS[template.slug] || template.title}</h3>
                  <p className="muted">Versão {template.version} · {template.slug}</p>
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(template)}>
                  Editar
                </button>
              </header>
              <div
                className="contract-body contract-preview"
                dangerouslySetInnerHTML={{ __html: template.body_html }}
              />
            </section>
          ))}

          {editing && (
            <form className="form-card" onSubmit={saveTemplate}>
              <h3>Editar — {TEMPLATE_LABELS[editing] || editing}</h3>
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Conteúdo HTML
                <textarea
                  rows={16}
                  value={form.body_html}
                  onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                  required
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar modelo'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Placa</th>
                <th>Versão</th>
                <th>Cópia</th>
              </tr>
            </thead>
            <tbody>
              {aceites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">Nenhum aceite registrado.</td>
                </tr>
              ) : (
                aceites.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.accepted_at).toLocaleString('pt-BR')}</td>
                    <td>
                      {item.user_name || item.user_email}
                      <small className="muted">{item.user_email}</small>
                    </td>
                    <td>{ACCEPTANCE_LABELS[item.acceptance_type] || item.acceptance_type}</td>
                    <td>{item.vehicle_plate || '—'}</td>
                    <td>v{item.template_version}</td>
                    <td>
                      {item.has_snapshot ? (
                        <button type="button" className="btn-secondary btn-sm" onClick={() => downloadAcceptance(item.id)}>
                          Baixar
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
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
