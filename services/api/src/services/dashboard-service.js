const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getVehicleService } = require('./vehicle-service');
const { buildFinancialSummary } = require('./financeiro-service');

async function getDashboard(userId) {
  const repo = getVehicleRepository();
  const vehicles = await getVehicleService().listForUser(userId);
  const veiculosAtivos = await repo.countActiveByUser(userId);
  const situacaoFinanceira = await buildFinancialSummary(userId)();

  const veiculosComLocalizacao = [];
  for (const v of vehicles.filter(x => x.status === 'active' && (x.gpswox_device_id || x.gpswox_name))) {
    try {
      const loc = await getVehicleService().getLocation(userId, v.id);
      veiculosComLocalizacao.push({
        id: v.id,
        label: v.label,
        plate: v.plate,
        endereco: loc.localizacao.endereco,
        velocidade: loc.localizacao.velocidade,
        latitude: loc.localizacao.latitude,
        longitude: loc.localizacao.longitude,
      });
    } catch {
      veiculosComLocalizacao.push({
        id: v.id,
        label: v.label,
        plate: v.plate,
        endereco: null,
        velocidade: null,
      });
    }
  }

  return {
    veiculos_ativos: veiculosAtivos,
    veiculos_total: vehicles.length,
    veiculos: vehicles,
    veiculos_resumo: veiculosComLocalizacao,
    alertas_recentes: [],
    notificacoes_recentes: [],
    situacao_financeira: situacaoFinanceira,
    atalhos: ['meu-veiculo', 'financeiro', 'alertas', 'emergencia'],
  };
}

module.exports = { getDashboard };
