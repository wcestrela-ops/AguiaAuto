import { describe, expect, it, vi } from 'vitest';
import { setClientPageError } from './client-api-error';

describe('setClientPageError', () => {
  it('ignora CONTRACT_REQUIRED', () => {
    const setError = vi.fn();
    setClientPageError(setError, { code: 'CONTRACT_REQUIRED', message: 'Aceite o contrato' });
    expect(setError).not.toHaveBeenCalled();
  });

  it('propaga outros erros', () => {
    const setError = vi.fn();
    setClientPageError(setError, new Error('Falha de rede'));
    expect(setError).toHaveBeenCalledWith('Falha de rede');
  });

  it('usa fallback quando mensagem ausente', () => {
    const setError = vi.fn();
    setClientPageError(setError, {});
    expect(setError).toHaveBeenCalledWith('Erro inesperado.');
  });
});
