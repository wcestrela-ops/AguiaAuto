import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, isContractRequiredError } from './client.js';

describe('isContractRequiredError', () => {
  it('detecta por code ou flag contractRequired', () => {
    expect(isContractRequiredError({ code: 'CONTRACT_REQUIRED' })).toBe(true);
    expect(isContractRequiredError({ contractRequired: true })).toBe(true);
    expect(isContractRequiredError(new Error('outro'))).toBe(false);
  });
});

describe('ApiClient CONTRACT_REQUIRED', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setServiceContractAccepted(true);
    api.setContractRequiredHandler(null);
    vi.restoreAllMocks();
  });

  it('emite handler e invalida cache local', async () => {
    const handler = vi.fn();
    api.setContractRequiredHandler(handler);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: 'CONTRACT_REQUIRED',
        message: 'Aceite o contrato.',
      }),
    })));

    await expect(api.getDashboard()).rejects.toMatchObject({
      code: 'CONTRACT_REQUIRED',
      contractRequired: true,
    });

    expect(handler).toHaveBeenCalledWith('Aceite o contrato.');
    expect(api.isServiceContractAccepted()).toBe(false);
  });

  it('não dispara handler para erros comuns', async () => {
    const handler = vi.fn();
    api.setContractRequiredHandler(handler);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'INTERNAL' }),
    })));

    await expect(api.getDashboard()).rejects.toThrow('INTERNAL');
    expect(handler).not.toHaveBeenCalled();
  });
});
