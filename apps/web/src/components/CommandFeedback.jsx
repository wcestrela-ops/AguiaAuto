export function channelBadgeClass(channel) {
  return channel === 'sms' ? 'info' : 'success';
}

export function statusBadgeClass(status) {
  if (status === 'failed') return 'error';
  if (status === 'queued' || status === 'processing') return 'warning';
  if (status === 'duplicate') return 'warning';
  return 'success';
}

export default function CommandFeedback({ feedback, compact = false }) {
  if (!feedback) return null;

  return (
    <div className={`command-feedback${compact ? ' command-feedback-compact' : ''}`}>
      <div className="command-feedback-badges">
        <span className={`badge ${channelBadgeClass(feedback.channel)}`}>
          {feedback.channel_label || feedback.channel}
        </span>
        <span className={`badge ${statusBadgeClass(feedback.status)}`}>
          {feedback.status_label || feedback.status}
        </span>
        {feedback.failover && (
          <span className="badge warning">Backup SMS</span>
        )}
      </div>
      <p className="command-feedback-message">{feedback.message}</p>
      {feedback.hint && !compact && (
        <p className="guide-inline">{feedback.hint}</p>
      )}
    </div>
  );
}

export function CommandHistoryList({ items = [] }) {
  if (!items.length) {
    return <p className="muted">Nenhum comando registrado ainda.</p>;
  }

  return (
    <div className="command-history-list">
      {items.map((item) => (
        <div key={item.id} className="command-history-item">
          <div className="command-history-meta">
            <strong>{item.action}</strong>
            <span className={`badge ${channelBadgeClass(item.channel)}`}>{item.channel_label}</span>
            <span className={`badge ${statusBadgeClass(item.status)}`}>{item.status_label}</span>
            <small className="muted">
              {new Date(item.created_at).toLocaleString('pt-BR')}
            </small>
          </div>
          {item.error_message && (
            <small className="command-history-error">{item.error_message}</small>
          )}
        </div>
      ))}
    </div>
  );
}
