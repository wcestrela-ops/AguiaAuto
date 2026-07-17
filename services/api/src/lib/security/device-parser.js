function parseDeviceLabel(userAgent = '') {
  const ua = String(userAgent);
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desconhecido';
}

function parseBrowser(userAgent = '') {
  const ua = String(userAgent);
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Navegador';
}

module.exports = {
  parseDeviceLabel,
  parseBrowser,
  buildSessionLabel(userAgent) {
    return `${parseBrowser(userAgent)} · ${parseDeviceLabel(userAgent)}`;
  },
};
