function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }
  if (digits.startsWith('55')) return digits;
  return digits;
}

module.exports = { normalizePhone };
