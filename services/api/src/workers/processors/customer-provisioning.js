const { getProvisioningService } = require('../../services/provisioning-service');

async function processCustomerProvisioning(job) {
  const { userId, plan_id, billing_type } = job.data;
  return getProvisioningService().provisionNewClient(userId, { plan_id, billing_type });
}

module.exports = { processCustomerProvisioning };
