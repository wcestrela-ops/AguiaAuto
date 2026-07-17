const { getContractService } = require('../../services/contract-service');

async function processContractGeneration(job) {
  const { userId, type = 'servico', installationLogId } = job.data;
  return getContractService().getDownloadDocument(userId, { type, installationLogId });
}

module.exports = { processContractGeneration };
