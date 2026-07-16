import { useState } from 'react';
import { api } from '../api/client';

export default function ExportButtons({
  resource,
  params = {},
  disabled = false,
  className = '',
}) {
  const [loading, setLoading] = useState('');

  async function download(format) {
    setLoading(format);
    try {
      await api.downloadAdminExport(resource, format, params);
    } catch (err) {
      window.alert(err.message || 'Falha ao exportar.');
    } finally {
      setLoading('');
    }
  }

  return (
    <div className={`export-buttons ${className}`.trim()}>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={disabled || Boolean(loading)}
        onClick={() => download('xlsx')}
      >
        {loading === 'xlsx' ? 'Gerando Excel…' : 'Excel (.xlsx)'}
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={disabled || Boolean(loading)}
        onClick={() => download('pdf')}
      >
        {loading === 'pdf' ? 'Gerando PDF…' : 'PDF'}
      </button>
    </div>
  );
}
