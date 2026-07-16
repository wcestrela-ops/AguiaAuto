import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminGuide } from '../content/admin-guides';
import { getClientGuide } from '../content/client-guides';

function resolveGuide(guideId, scope) {
  if (!guideId) return null;
  return scope === 'client' ? getClientGuide(guideId) : getAdminGuide(guideId);
}

function GuideContent({ guide }) {
  if (!guide) return null;

  return (
    <div className="help-guide-body">
      {guide.summary && <p className="guide-summary">{guide.summary}</p>}

      {guide.steps?.map((step, index) => (
        <div key={step.title || index} className="guide-step">
          <h4>{step.title}</h4>
          <p>{step.body}</p>
        </div>
      ))}

      {guide.links?.length > 0 && (
        <div className="guide-links">
          <strong>Links úteis</strong>
          <ul>
            {guide.links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} onClick={(e) => e.stopPropagation()}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function HelpModal({ guide, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!guide) return null;

  return (
    <div className="help-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-modal-header">
          <h2 id="help-modal-title">{guide.title}</h2>
          <button type="button" className="help-modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <GuideContent guide={guide} />
      </div>
    </div>
  );
}

export function HelpButton({ guideId, label = 'Como configurar', className = '', size = 'md', scope = 'admin' }) {
  const [open, setOpen] = useState(false);
  const guide = resolveGuide(guideId, scope);

  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        className={`help-btn help-btn-${size} ${className}`.trim()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={label}
        aria-label={label}
      >
        ?
      </button>
      {open && <HelpModal guide={guide} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Texto curto abaixo de títulos/seções — tom mais suave que info-box */
export function InlineGuide({ guideId, text, scope = 'admin' }) {
  const guide = guideId ? resolveGuide(guideId, scope) : null;
  const content = text || guide?.summary;
  if (!content) return null;
  return <p className="guide-inline">{content}</p>;
}

/** Cabeçalho de página com botão de ajuda opcional */
export function PageHeaderWithHelp({
  title,
  subtitle,
  guideId,
  children,
  className = 'page-header row',
  scope = 'admin',
}) {
  return (
    <header className={className}>
      <div>
        <div className="page-title-row">
          <h1>{title}</h1>
          {guideId && <HelpButton guideId={guideId} scope={scope} />}
        </div>
        {subtitle && <p>{subtitle}</p>}
        {guideId && <InlineGuide guideId={guideId} scope={scope} />}
      </div>
      {children}
    </header>
  );
}

/** Título de seção com botão ? */
export function SectionTitleWithHelp({ title, guideId, as: Tag = 'h3', scope = 'admin' }) {
  return (
    <div className="section-title-row">
      <Tag>{title}</Tag>
      {guideId && <HelpButton guideId={guideId} size="sm" scope={scope} />}
    </div>
  );
}
