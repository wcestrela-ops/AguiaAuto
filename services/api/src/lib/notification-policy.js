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

function filterVehicleAlertChannels(channels = []) {
  return channels.filter(c => VEHICLE_ALERT_CHANNELS.includes(c));
}

function isWhatsAppAllowedForVehicleAlerts() {
  return false;
}

module.exports = {
  VEHICLE_ALERT_CHANNELS,
  WHATSAPP_TRANSACTIONAL_TYPES,
  filterVehicleAlertChannels,
  isWhatsAppAllowedForVehicleAlerts,
};
