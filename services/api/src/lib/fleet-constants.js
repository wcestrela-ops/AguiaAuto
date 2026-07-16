const DOC_TYPES = {
  crlv: 'CRLV',
  seguro: 'Seguro',
  ipva: 'IPVA',
  licenciamento: 'Licenciamento',
  outro: 'Outro',
};

const MAINTENANCE_TYPES = {
  oleo: 'Troca de óleo',
  revisao: 'Revisão geral',
  pneus: 'Pneus',
  freios: 'Freios',
  bateria: 'Bateria',
  outro: 'Outro',
};

function docTypeLabel(key) {
  return DOC_TYPES[key] || key || 'Outro';
}

function maintenanceTypeLabel(key) {
  return MAINTENANCE_TYPES[key] || key || 'Outro';
}

module.exports = {
  DOC_TYPES,
  MAINTENANCE_TYPES,
  docTypeLabel,
  maintenanceTypeLabel,
};
