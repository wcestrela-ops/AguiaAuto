const MIN_LENGTH = parseInt(process.env.PASSWORD_MIN_LENGTH || '10', 10);

const WEAK_PATTERNS = [
  /^123456/,
  /^password/i,
  /^senha/i,
  /^admin/i,
  /^qwerty/i,
  /^(.)\1{5,}$/,
];

function validatePassword(password, { email } = {}) {
  const errors = [];
  const value = String(password || '');

  if (value.length < MIN_LENGTH) {
    errors.push(`A senha deve ter no mínimo ${MIN_LENGTH} caracteres.`);
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    errors.push('A senha deve conter letras maiúsculas, minúsculas e números.');
  }

  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(value)) {
      errors.push('Senha muito fraca ou previsível.');
      break;
    }
  }

  if (email) {
    const local = String(email).split('@')[0]?.toLowerCase();
    if (local && local.length >= 4 && value.toLowerCase().includes(local)) {
      errors.push('A senha não pode conter partes do e-mail.');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateTransactionPin(pin) {
  const value = String(pin || '');
  if (!/^\d{4,6}$/.test(value)) {
    return { valid: false, errors: ['PIN transacional deve ter 4 a 6 dígitos numéricos.'] };
  }
  if (/^(\d)\1+$/.test(value)) {
    return { valid: false, errors: ['PIN transacional muito fraco.'] };
  }
  return { valid: true, errors: [] };
}

module.exports = { validatePassword, validateTransactionPin, MIN_LENGTH };
