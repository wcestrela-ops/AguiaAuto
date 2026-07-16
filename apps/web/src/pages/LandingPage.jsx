import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function whatsappHref(number) {
  const digits = String(number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:+${digits.startsWith('55') ? digits : `55${digits}`}` : null;
}

export default function LandingPage() {
  const [content, setContent] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    if (api.isClientLoggedIn()) return;

    Promise.all([
      api.getPublicLanding(),
      api.getPlans().catch(() => ({ data: [] })),
    ])
      .then(([landingRes, plansRes]) => {
        const data = landingRes.data;
        if (data?.redirect) {
          setRedirect(data.redirect);
          return;
        }
        setContent(data?.content || null);
        setPlans(plansRes.data || []);
      })
      .catch(() => setRedirect('/login'))
      .finally(() => setLoading(false));
  }, []);

  if (api.isClientLoggedIn()) {
    return <Navigate to="/app" replace />;
  }

  if (loading) {
    return (
      <div className="landing-page">
        <p className="muted landing-loading">Carregando...</p>
      </div>
    );
  }

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  if (!content) {
    return <Navigate to="/login" replace />;
  }

  const waLink = whatsappHref(content.contact_whatsapp);
  const phoneLink = telHref(content.contact_phone);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <span className="landing-brand-icon">{content.brand_icon}</span>
            <strong>{content.brand_name}</strong>
          </div>
          <nav className="landing-nav">
            <Link to={content.hero_cta_secondary_url || '/login'}>{content.hero_cta_secondary_label || 'Entrar'}</Link>
            <Link to={content.hero_cta_primary_url || '/cadastro'} className="landing-btn landing-btn-primary landing-btn-sm">
              {content.hero_cta_primary_label || 'Criar conta'}
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1>{content.hero_title}</h1>
          <p className="landing-hero-sub">{content.hero_subtitle}</p>
          <div className="landing-hero-actions">
            <Link to={content.hero_cta_primary_url || '/cadastro'} className="landing-btn landing-btn-primary">
              {content.hero_cta_primary_label || 'Criar conta'}
            </Link>
            <Link to={content.hero_cta_secondary_url || '/login'} className="landing-btn landing-btn-secondary">
              {content.hero_cta_secondary_label || 'Entrar'}
            </Link>
          </div>
        </div>
      </section>

      {(content.features || []).length > 0 && (
        <section className="landing-section">
          <div className="landing-section-inner">
            <h2>{content.features_title}</h2>
            <div className="landing-features">
              {content.features.map((feature, index) => (
                <article key={`${feature.title}-${index}`} className="landing-feature-card">
                  <span className="landing-feature-icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {content.plans_section_enabled && plans.length > 0 && (
        <section className="landing-section landing-section-alt">
          <div className="landing-section-inner">
            <h2>{content.plans_section_title}</h2>
            {content.plans_section_subtitle && (
              <p className="landing-section-sub">{content.plans_section_subtitle}</p>
            )}
            <div className="landing-plans">
              {plans.map((plan) => (
                <article key={plan.id} className="landing-plan-card">
                  <h3>{plan.name}</h3>
                  {plan.description && <p>{plan.description}</p>}
                  <p className="landing-plan-price">{formatMoney(plan.price_monthly)}<small>/mês</small></p>
                  <Link to={`/cadastro?plan=${plan.id}`} className="landing-btn landing-btn-primary landing-btn-block">
                    Assinar este plano
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {(content.contact_phone || content.contact_whatsapp || content.contact_email) && (
        <section className="landing-section">
          <div className="landing-section-inner landing-contact">
            <h2>{content.contact_title}</h2>
            <div className="landing-contact-links">
              {content.contact_phone && phoneLink && (
                <a href={phoneLink}>{content.contact_phone}</a>
              )}
              {content.contact_whatsapp && waLink && (
                <a href={waLink} target="_blank" rel="noreferrer">WhatsApp</a>
              )}
              {content.contact_email && (
                <a href={`mailto:${content.contact_email}`}>{content.contact_email}</a>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p>{content.footer_text}</p>
          <div className="landing-footer-links">
            <Link to="/login">Área do cliente</Link>
            <Link to="/admin/login">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
