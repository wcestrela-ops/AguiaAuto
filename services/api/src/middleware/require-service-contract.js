const { getContractRepository } = require('../repositories/contract-repository');

async function requireServiceContract(req, res, next) {
  if (!req.user || req.user.role !== 'client') {
    return next();
  }

  try {
    const accepted = await getContractRepository().hasServiceAcceptance(req.user.id);
    if (accepted) return next();

    return res.status(403).json({
      success: false,
      error: 'CONTRACT_REQUIRED',
      message: 'Aceite o Contrato de Prestação de Serviços em /app/contratos para continuar.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { requireServiceContract };
