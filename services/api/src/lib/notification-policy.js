/**
 * Política anti-ban WhatsApp:
 * - Alertas de veículo (ignição, rota, velocidade, etc.) → APENAS push
 * - WhatsApp reservado para mensagens transacionais e promoções manuais do admin
 */
const VEHICLE_ALERT_CHANNELS = ['push'];

const WHATSAPP_TRANSACTIONAL_TYPES = [
  'cadastro',
  'cobranca',
  'recuperacao_senha',
  'promocao',
];

const PASSWORD_RESET_CHANNELS = ['email', 'whatsapp', 'both'];

function filterVehicleAlertChannels(channels = []) {
  return channels.filter(c => VEHICLE_ALERT_CHANNELS.includes(c));
}

function isWhatsAppAllowedForVehicleAlerts() {
  return false;
}

function isWhatsAppAllowedForAuth(type) {
  return WHATSAPP_TRANSACTIONAL_TYPES.includes(type);
}

function normalizePasswordResetChannel(channel) {
  const value = String(channel || 'both').toLowerCase();
  return PASSWORD_RESET_CHANNELS.includes(value) ? value : 'both';
}

/**
 * Define canais de envio do código de recuperação.
 * - Sem telefone cadastrado → somente e-mail
 * - both (padrão) → mesmo código por e-mail e WhatsApp
 */
function resolvePasswordResetChannels({ channel, hasPhone }) {
  const selected = normalizePasswordResetChannel(channel);

  if (!hasPhone) {
    return ['email'];
  }

  if (selected === 'email') return ['email'];
  if (selected === 'whatsapp') return ['whatsapp'];
  return ['email', 'whatsapp'];
}

function buildPasswordResetMessage(channels = []) {
  if (channels.includes('email') && channels.includes('whatsapp')) {
    return 'Se o e-mail estiver cadastrado, você receberá o mesmo código por e-mail e WhatsApp.';
  }
  if (channels.includes('whatsapp')) {
    return 'Se o e-mail estiver cadastrado, você receberá um código no WhatsApp cadastrado.';
  }
  return 'Se o e-mail estiver cadastrado, você receberá um código por e-mail.';
}

module.exports = {
  VEHICLE_ALERT_CHANNELS,
  WHATSAPP_TRANSACTIONAL_TYPES,
  PASSWORD_RESET_CHANNELS,
  filterVehicleAlertChannels,
  isWhatsAppAllowedForVehicleAlerts,
  isWhatsAppAllowedForAuth,
  normalizePasswordResetChannel,
  resolvePasswordResetChannels,
  buildPasswordResetMessage,
};
