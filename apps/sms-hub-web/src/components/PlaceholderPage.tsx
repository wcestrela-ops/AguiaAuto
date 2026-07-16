interface Props {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div>
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--muted)' }}>Em desenvolvimento — MVP fase 1 concluída com autenticação e layout.</p>
      </div>
    </div>
  );
}
