const { getContractRepository } = require('../repositories/contract-repository');
const { checkServiceContractAccess } = require('../lib/service-contract-guard');

async function requireServiceContract(req, res, next) {
  try {
    const result = await checkServiceContractAccess(
      req.user,
      (userId) => getContractRepository().hasServiceAcceptance(userId),
    );

    if (result.allowed) return next();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { requireServiceContract };
