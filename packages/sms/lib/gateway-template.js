/**
 * Substitui variáveis no template URL (padrão GPSWOX SMS/WhatsApp gateway).
 * Suporta: %NUMBER%, %MESSAGE%, %USERNAME%, %PASSWORD%
 * e aliases USER / PASSWORD quando username/password informados separadamente.
 */
function applyGatewayTemplate(template, { phone, message, username, password }) {
  if (!template) throw new Error('URL template do gateway não configurada.');

  let url = String(template);

  if (username) {
    url = url
      .replace(/%USERNAME%/gi, encodeURIComponent(username))
      .replace(/(?:^|[?&])username=USER(?:&|$)/gi, (m) => m.replace('USER', encodeURIComponent(username)))
      .replace(/\bUSER\b/g, encodeURIComponent(username));
  }

  if (password) {
    url = url
      .replace(/%PASSWORD%/gi, encodeURIComponent(password))
      .replace(/(?:^|[?&])password=PASSWORD(?:&|$)/gi, (m) => m.replace('PASSWORD', encodeURIComponent(password)))
      .replace(/\bPASSWORD\b/g, encodeURIComponent(password));
  }

  url = url
    .replace(/%NUMBER%/gi, encodeURIComponent(phone))
    .replace(/%number%/g, encodeURIComponent(phone))
    .replace(/%MESSAGE%/gi, encodeURIComponent(message))
    .replace(/%message%/g, encodeURIComponent(message));

  return url;
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

module.exports = { applyGatewayTemplate, normalizePhoneDigits };
