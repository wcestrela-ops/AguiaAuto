export default function FieldInput({ field, value, onChange }) {
  const id = `field-${field.key}`;
  const hint = field.hint || field.description;

  if (field.type === 'boolean') {
    return (
      <label className="checkbox-row" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value === true || value === 'true'}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
        {hint && <small className="hint">{hint}</small>}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="required">*</span>}
        <select
          id={id}
          value={value ?? field.default ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {hint && <small className="hint">{hint}</small>}
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="required">*</span>}
        <textarea
          id={id}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
        />
        {hint && <small className="hint">{hint}</small>}
      </label>
    );
  }

  if (field.type === 'password') {
    return (
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="required">*</span>}
        <input
          id={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || (field.secret ? '••••••••' : '')}
        />
        <small className="hint">
          {hint || 'Deixe em branco para manter o valor atual (campos secretos).'}
        </small>
      </label>
    );
  }

  return (
    <label htmlFor={id}>
      {field.label}
      {field.required && <span className="required">*</span>}
      <input
        id={id}
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={value}
        onChange={(e) => onChange(field.type === 'number' ? parseInt(e.target.value, 10) : e.target.value)}
        placeholder={field.placeholder || ''}
      />
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}
