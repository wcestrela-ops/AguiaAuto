import { describe, expect, it } from 'vitest';
import {
  isValidImei,
  isValidTrackerPhone,
  normalizeImei,
  normalizeTrackerPhone,
} from './imei';

describe('imei utils', () => {
  it('normaliza IMEI removendo máscara', () => {
    expect(normalizeImei('3569-3803-5643-809')).toBe('356938035643809');
  });

  it('valida IMEI com checksum Luhn', () => {
    expect(isValidImei('356938035643809')).toBe(true);
    expect(isValidImei('356938035643800')).toBe(false);
  });

  it('valida chip SIM com 10–13 dígitos', () => {
    expect(isValidTrackerPhone('5511999999999')).toBe(true);
    expect(isValidTrackerPhone('123')).toBe(false);
  });

  it('normaliza telefone do chip', () => {
    expect(normalizeTrackerPhone('+55 (11) 99999-9999')).toBe('5511999999999');
  });
});
