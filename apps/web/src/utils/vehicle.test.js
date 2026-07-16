import { describe, expect, it } from 'vitest';
import { vehicleStatusBadge, vehicleStatusLabel } from './vehicle';

describe('vehicle utils', () => {
  it('traduz status conhecidos', () => {
    expect(vehicleStatusLabel('pending_installation')).toBe('Aguardando instalação');
    expect(vehicleStatusLabel('active')).toBe('Ativo');
  });

  it('retorna status desconhecido como fallback', () => {
    expect(vehicleStatusLabel('custom')).toBe('custom');
  });

  it('mapeia badge por status', () => {
    expect(vehicleStatusBadge('blocked')).toBe('error');
    expect(vehicleStatusBadge('unknown')).toBe('info');
  });
});
