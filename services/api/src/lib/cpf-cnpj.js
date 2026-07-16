function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isRepeatedDigits(digits) {
  return /^(\d)\1+$/.test(digits);
}

function validateCpf(digits) {
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
}

function validateCnpj(digits) {
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * weights1[i];
  let check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  if (check !== Number(digits[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i += 1) sum += Number(digits[i]) * weights2[i];
  check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  return check === Number(digits[13]);
}

function validateCpfCnpj(value) {
  const digits = onlyDigits(value);
  if (!digits) {
    return { valid: false, error: 'CPF/CNPJ é obrigatório.', normalized: null, type: null };
  }

  if (digits.length === 11) {
    const valid = validateCpf(digits);
    return {
      valid,
      error: valid ? null : 'CPF inválido.',
      normalized: digits,
      type: 'cpf',
    };
  }

  if (digits.length === 14) {
    const valid = validateCnpj(digits);
    return {
      valid,
      error: valid ? null : 'CNPJ inválido.',
      normalized: digits,
      type: 'cnpj',
    };
  }

  return {
    valid: false,
    error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
    normalized: digits,
    type: null,
  };
}

function formatCpfCnpj(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
}

module.exports = {
  onlyDigits,
  validateCpfCnpj,
  formatCpfCnpj,
};
