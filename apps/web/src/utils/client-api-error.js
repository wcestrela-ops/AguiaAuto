import { isContractRequiredError } from '../api/client';

export function setClientPageError(setError, err, fallback = 'Erro inesperado.') {
  if (isContractRequiredError(err)) return;
  setError(err?.message || fallback);
}
