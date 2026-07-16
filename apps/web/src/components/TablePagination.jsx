/** Paginação anterior/próxima para listagens admin. */
export default function TablePagination({ offset, pageSize, total, onPageChange }) {
  const canPrev = offset > 0;
  const canNext = offset + pageSize < total;

  if (total <= pageSize) return null;

  return (
    <div className="audit-pagination">
      <button
        type="button"
        className="btn-secondary"
        disabled={!canPrev}
        onClick={() => onPageChange(offset - pageSize)}
      >
        Anterior
      </button>
      <span className="muted pagination-meta">
        {offset + 1}–{Math.min(offset + pageSize, total)} de {total}
      </span>
      <button
        type="button"
        className="btn-secondary"
        disabled={!canNext}
        onClick={() => onPageChange(offset + pageSize)}
      >
        Próxima
      </button>
    </div>
  );
}
