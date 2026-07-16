const { formatDateBr, formatDateTimeBr, formatMoneyBr, cell } = require('./formatters');

const PROVISIONING_LABELS = {
  pending: 'Pendente',
  completed: 'Concluído',
  partial: 'Parcial',
  failed: 'Falhou',
};

const VEHICLE_STATUS_LABELS = {
  pending_installation: 'Aguardando instalação',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};

const INVOICE_STATUS_LABELS = {
  pending: 'Pendente',
  overdue: 'Vencida',
  paid: 'Paga',
  cancelled: 'Cancelada',
  waived: 'Isenta',
  refunded: 'Estornada',
};

const FLEET_STATUS_LABELS = {
  vencido: 'Vencido',
  vencendo: 'Vencendo',
  ok: 'Em dia',
  sem_vencimento: 'Sem vencimento',
};

const CLIENTES_COLUMNS = [
  { header: 'ID', value: (r) => cell(r.id) },
  { header: 'Nome', value: (r) => cell(r.name) },
  { header: 'E-mail', value: (r) => cell(r.email) },
  { header: 'Telefone', value: (r) => cell(r.phone) },
  { header: 'CPF/CNPJ', value: (r) => cell(r.cpf_cnpj) },
  { header: 'Conta ativa', value: (r) => cell(r.active) },
  { header: 'Veículos (ativos/total)', value: (r) => `${r.vehicles_active || 0}/${r.vehicles_count || 0}` },
  { header: 'Faturas abertas', value: (r) => cell(r.open_invoices) },
  { header: 'Provisionamento', value: (r) => PROVISIONING_LABELS[r.provisioning_status] || r.provisioning_status || 'Pendente' },
  { header: 'Último acesso', value: (r) => formatDateTimeBr(r.last_access_at) },
  { header: 'IP último acesso', value: (r) => cell(r.last_access_ip) },
  { header: 'Cadastro', value: (r) => formatDateBr(r.created_at) },
];

const VEICULOS_COLUMNS = [
  { header: 'ID', value: (r) => cell(r.id) },
  { header: 'Placa', value: (r) => cell(r.plate || 'Sem placa') },
  { header: 'Cliente', value: (r) => cell(r.user_name || r.user_email) },
  { header: 'E-mail cliente', value: (r) => cell(r.user_email) },
  { header: 'Marca', value: (r) => cell(r.brand) },
  { header: 'Modelo', value: (r) => cell(r.model) },
  { header: 'Device ID rastreador', value: (r) => cell(r.tracker_device_id) },
  { header: 'Chip SIM', value: (r) => cell(r.tracker_phone) },
  { header: 'IMEI', value: (r) => cell(r.tracker_imei) },
  { header: 'Modelo rastreador', value: (r) => cell(r.tracker_model) },
  { header: 'Status', value: (r) => VEHICLE_STATUS_LABELS[r.status] || r.status },
  { header: 'Instalador', value: (r) => cell(r.assigned_installer_name || r.assigned_installer_email) },
  { header: 'Agendamento', value: (r) => formatDateTimeBr(r.installation_scheduled_at) },
  { header: 'Cadastro', value: (r) => formatDateBr(r.created_at) },
];

const COBRANCAS_COLUMNS = [
  { header: 'ID', value: (r) => cell(r.id) },
  { header: 'Cliente', value: (r) => cell(r.user_name || r.user_email) },
  { header: 'E-mail', value: (r) => cell(r.user_email) },
  { header: 'Descrição', value: (r) => cell(r.description) },
  { header: 'Valor', value: (r) => formatMoneyBr(r.amount) },
  { header: 'Vencimento', value: (r) => formatDateBr(r.due_date) },
  { header: 'Gateway', value: (r) => cell(r.payment_provider) },
  { header: 'Status', value: (r) => INVOICE_STATUS_LABELS[r.status] || r.status },
  { header: 'Pago em', value: (r) => formatDateTimeBr(r.paid_at) },
];

const FROTA_DOCS_COLUMNS = [
  { header: 'Cliente', value: (r) => cell(r.user_name || r.user_email) },
  { header: 'Placa', value: (r) => cell(r.plate || 'Sem placa') },
  { header: 'Tipo', value: (r) => cell(r.doc_type_label || r.doc_type) },
  { header: 'Título', value: (r) => cell(r.title) },
  { header: 'Vencimento', value: (r) => formatDateBr(r.expiry_date) },
  { header: 'Status', value: (r) => FLEET_STATUS_LABELS[r.expiry_status] || r.expiry_status },
  { header: 'Anexo', value: (r) => cell(r.has_file ? (r.original_filename || 'Sim') : 'Não') },
];

const FROTA_MAINT_COLUMNS = [
  { header: 'Cliente', value: (r) => cell(r.user_name || r.user_email) },
  { header: 'Placa', value: (r) => cell(r.plate || 'Sem placa') },
  { header: 'Serviço', value: (r) => cell(r.service_type_label || r.title) },
  { header: 'Título', value: (r) => cell(r.title) },
  { header: 'Realizada', value: (r) => formatDateBr(r.performed_at) },
  { header: 'Próxima revisão', value: (r) => formatDateBr(r.next_due_date) },
  { header: 'Status', value: (r) => FLEET_STATUS_LABELS[r.due_status] || r.due_status || '' },
  { header: 'KM', value: (r) => cell(r.odometer_km) },
  { header: 'Custo', value: (r) => formatMoneyBr(r.cost) },
];

const EMERGENCIA_COLUMNS = [
  { header: 'Data', value: (r) => formatDateTimeBr(r.created_at) },
  { header: 'Cliente', value: (r) => cell(r.user_name || r.user_email) },
  { header: 'Telefone', value: (r) => cell(r.user_phone) },
  { header: 'Placa', value: (r) => cell(r.plate || 'Sem placa') },
  { header: 'Endereço', value: (r) => cell(r.address) },
  { header: 'Latitude', value: (r) => cell(r.latitude) },
  { header: 'Longitude', value: (r) => cell(r.longitude) },
  { header: 'Mensagem', value: (r) => cell(r.message) },
  { header: 'Notificados', value: (r) => cell(r.notified_count) },
];

const SMS_COLUMNS = [
  { header: 'Data', value: (r) => formatDateTimeBr(r.created_at) },
  { header: 'Telefone', value: (r) => cell(r.phone) },
  { header: 'Ação', value: (r) => cell(r.action) },
  { header: 'Status', value: (r) => cell(r.status) },
  { header: 'Erro', value: (r) => cell(r.error_message) },
];

const AUDIT_COLUMNS = [
  { header: 'Data', value: (r) => formatDateTimeBr(r.created_at) },
  { header: 'Ator', value: (r) => `${r.actor_type || ''} #${r.actor_id || ''}`.trim() },
  { header: 'Ação', value: (r) => cell(r.action) },
  { header: 'Recurso', value: (r) => `${r.resource_type || ''} #${r.resource_id || ''}`.trim() },
  { header: 'Resumo', value: (r) => cell(typeof r.metadata === 'object' ? JSON.stringify(r.metadata) : r.metadata) },
  { header: 'IP', value: (r) => cell(r.ip_address) },
];

const CLIENTE_VEICULOS_COLUMNS = [
  { header: 'Placa', value: (r) => cell(r.plate || 'Sem placa') },
  { header: 'Marca/Modelo', value: (r) => [r.brand, r.model].filter(Boolean).join(' ') },
  { header: 'Status', value: (r) => VEHICLE_STATUS_LABELS[r.status] || r.status },
  { header: 'Chip SMS', value: (r) => cell(r.tracker_phone) },
  { header: 'Device rastreador', value: (r) => cell(r.tracker_device_id) },
];

const CLIENTE_FATURAS_COLUMNS = [
  { header: 'Descrição', value: (r) => cell(r.description) },
  { header: 'Valor', value: (r) => formatMoneyBr(r.amount) },
  { header: 'Vencimento', value: (r) => formatDateBr(r.due_date) },
  { header: 'Status', value: (r) => INVOICE_STATUS_LABELS[r.status] || r.status },
  { header: 'Gateway', value: (r) => cell(r.payment_provider) },
  { header: 'Pago em', value: (r) => formatDateTimeBr(r.paid_at) },
];

module.exports = {
  CLIENTES_COLUMNS,
  VEICULOS_COLUMNS,
  COBRANCAS_COLUMNS,
  FROTA_DOCS_COLUMNS,
  FROTA_MAINT_COLUMNS,
  EMERGENCIA_COLUMNS,
  SMS_COLUMNS,
  AUDIT_COLUMNS,
  CLIENTE_VEICULOS_COLUMNS,
  CLIENTE_FATURAS_COLUMNS,
  PROVISIONING_LABELS,
  VEHICLE_STATUS_LABELS,
};
