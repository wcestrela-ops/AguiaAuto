import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import PageAlerts from '../../components/PageAlerts';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const EMPTY_FEATURE = { icon: '✓', title: '', description: '' };

const DEFAULT_CONTENT = {
  enabled: true,
  brand_icon: '🦅',
  brand_name: 'Águia Gestão Veicular',
  hero_title: '',
  hero_subtitle: '',
  hero_cta_primary_label: 'Criar conta',
  hero_cta_primary_url: '/cadastro',
  hero_cta_secondary_label: 'Entrar',
  hero_cta_secondary_url: '/login',
  features_title: '',
  features: [],
  plans_section_enabled: true,
  plans_section_title: '',
  plans_section_subtitle: '',
  contact_title: '',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  footer_text: '',
  meta_description: '',
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AdminLandingPage() {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [meta, setMeta] = useState({ updated_at: null, updated_by: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.getAdminLanding();
      setContent({ ...DEFAULT_CONTENT, ...(res.data?.content || {}) });
      setMeta({
        updated_at: res.data?.updated_at,
        updated_by: res.data?.updated_by,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateField(key, value) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function updateFeature(index, key, value) {
    setContent((prev) => {
      const features = [...(prev.features || [])];
      features[index] = { ...features[index], [key]: value };
      return { ...prev, features };
    });
  }

  function addFeature() {
    setContent((prev) => ({
      ...prev,
      features: [...(prev.features || []), { ...EMPTY_FEATURE }],
    }));
  }

  function removeFeature(index) {
    setContent((prev) => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await api.updateAdminLanding(content);
      setMessage('Landing page salva com sucesso.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeaderWithHelp
        title="Landing page"
        subtitle="Edite a página inicial pública — textos, recursos, planos e contato sem alterar código."
        guideId="admin_landing"
      >
        <a href="/" target="_blank" rel="noreferrer" className="btn-secondary header-action">
          Ver página pública
        </a>
      </PageHeaderWithHelp>

      <PageAlerts error={error} message={message} />

      {loading ? (
        <p className="loading-placeholder">Carregando...</p>
      ) : (
        <>
      {meta.updated_at && (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Última alteração: {formatDateTime(meta.updated_at)}
          {meta.updated_by ? ` por ${meta.updated_by}` : ''}
        </p>
      )}

      <form className="form-card" onSubmit={handleSubmit}>
        <SectionTitleWithHelp title="Geral" guideId="admin_landing" />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={content.enabled}
            onChange={(e) => updateField('enabled', e.target.checked)}
          />
          Landing page ativa (se desligada, visitantes são redirecionados para login)
        </label>

        <div className="form-row">
          <label>
            Ícone da marca
            <input value={content.brand_icon} onChange={(e) => updateField('brand_icon', e.target.value)} maxLength={8} />
          </label>
          <label>
            Nome da marca
            <input value={content.brand_name} onChange={(e) => updateField('brand_name', e.target.value)} required />
          </label>
        </div>

        <label>
          Meta description (SEO)
          <input value={content.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} />
        </label>

        <SectionTitleWithHelp title="Hero (topo)" guideId="admin_landing" />

        <label>
          Título principal
          <input value={content.hero_title} onChange={(e) => updateField('hero_title', e.target.value)} required />
        </label>
        <label>
          Subtítulo
          <textarea value={content.hero_subtitle} onChange={(e) => updateField('hero_subtitle', e.target.value)} rows={3} required />
        </label>

        <div className="form-row">
          <label>
            Botão primário — texto
            <input value={content.hero_cta_primary_label} onChange={(e) => updateField('hero_cta_primary_label', e.target.value)} />
          </label>
          <label>
            Botão primário — link
            <input value={content.hero_cta_primary_url} onChange={(e) => updateField('hero_cta_primary_url', e.target.value)} placeholder="/cadastro" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Botão secundário — texto
            <input value={content.hero_cta_secondary_label} onChange={(e) => updateField('hero_cta_secondary_label', e.target.value)} />
          </label>
          <label>
            Botão secundário — link
            <input value={content.hero_cta_secondary_url} onChange={(e) => updateField('hero_cta_secondary_url', e.target.value)} placeholder="/login" />
          </label>
        </div>

        <SectionTitleWithHelp title="Recursos / benefícios" guideId="admin_landing" />

        <label>
          Título da seção
          <input value={content.features_title} onChange={(e) => updateField('features_title', e.target.value)} />
        </label>

        {(content.features || []).map((feature, index) => (
          <fieldset key={index} className="register-fieldset">
            <legend>Recurso {index + 1}</legend>
            <div className="form-row">
              <label>
                Ícone
                <input value={feature.icon} onChange={(e) => updateFeature(index, 'icon', e.target.value)} maxLength={8} />
              </label>
              <label>
                Título
                <input value={feature.title} onChange={(e) => updateFeature(index, 'title', e.target.value)} required />
              </label>
            </div>
            <label>
              Descrição
              <textarea value={feature.description} onChange={(e) => updateFeature(index, 'description', e.target.value)} rows={2} />
            </label>
            <button type="button" className="btn-ghost btn-sm" onClick={() => removeFeature(index)}>
              Remover recurso
            </button>
          </fieldset>
        ))}

        <button type="button" className="btn-secondary" onClick={addFeature}>+ Adicionar recurso</button>

        <SectionTitleWithHelp title="Seção de planos" guideId="admin_landing" />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={content.plans_section_enabled}
            onChange={(e) => updateField('plans_section_enabled', e.target.checked)}
          />
          Exibir planos ativos na landing (cadastrados em <Link to="/admin/planos">Planos</Link>)
        </label>

        <label>
          Título da seção de planos
          <input value={content.plans_section_title} onChange={(e) => updateField('plans_section_title', e.target.value)} />
        </label>
        <label>
          Subtítulo da seção de planos
          <input value={content.plans_section_subtitle} onChange={(e) => updateField('plans_section_subtitle', e.target.value)} />
        </label>

        <SectionTitleWithHelp title="Contato e rodapé" guideId="admin_landing" />

        <label>
          Título contato
          <input value={content.contact_title} onChange={(e) => updateField('contact_title', e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Telefone
            <input value={content.contact_phone} onChange={(e) => updateField('contact_phone', e.target.value)} placeholder="(85) 99999-9999" />
          </label>
          <label>
            WhatsApp
            <input value={content.contact_whatsapp} onChange={(e) => updateField('contact_whatsapp', e.target.value)} placeholder="5585999999999" />
          </label>
        </div>
        <label>
          E-mail
          <input type="email" value={content.contact_email} onChange={(e) => updateField('contact_email', e.target.value)} />
        </label>
        <label>
          Texto do rodapé
          <input value={content.footer_text} onChange={(e) => updateField('footer_text', e.target.value)} />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar landing page'}
          </button>
          <a href="/" target="_blank" rel="noreferrer" className="btn-secondary">Pré-visualizar</a>
        </div>
      </form>
        </>
      )}
    </div>
  );
}
