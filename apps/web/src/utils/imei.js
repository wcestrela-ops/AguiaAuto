export function normalizeImei(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidImei(value) {
  const imei = normalizeImei(value);
  if (imei.length !== 15) return false;

  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let digit = parseInt(imei[14 - i], 10);
    if (Number.isNaN(digit)) return false;
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function normalizeTrackerPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidTrackerPhone(value) {
  const phone = normalizeTrackerPhone(value);
  return phone.length >= 10 && phone.length <= 13;
}
