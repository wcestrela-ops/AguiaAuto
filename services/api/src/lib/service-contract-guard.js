async function checkServiceContractAccess(user, hasServiceAcceptance) {
  if (!user || user.role !== 'client') {
    return { allowed: true };
  }

  const accepted = await hasServiceAcceptance(user.id);
  if (accepted) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 403,
    body: {
      success: false,
      error: 'CONTRACT_REQUIRED',
      message: 'Aceite o Contrato de Prestação de Serviços em /app/contratos para continuar.',
    },
  };
}

module.exports = { checkServiceContractAccess };
