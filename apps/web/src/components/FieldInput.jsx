export default function FieldInput({ field, value, onChange }) {
  const id = `field-${field.key}`;

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
          placeholder={field.secret ? '••••••••' : ''}
        />
        <small className="hint">Deixe em branco para manter o valor atual (campos secretos).</small>
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
      />
    </label>
  );
}
