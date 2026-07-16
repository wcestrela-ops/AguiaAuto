const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeImei,
  isValidImei,
  normalizeTrackerPhone,
  isValidTrackerPhone,
} = require('../../src/lib/imei');

describe('imei', () => {
  describe('normalizeImei', () => {
    it('remove caracteres não numéricos', () => {
      assert.equal(normalizeImei('3569-3803-5643-809'), '356938035643809');
    });

    it('retorna string vazia para valores nulos', () => {
      assert.equal(normalizeImei(null), '');
    });
  });

  describe('isValidImei', () => {
    it('aceita IMEI válido de 15 dígitos (Luhn)', () => {
      assert.equal(isValidImei('356938035643809'), true);
    });

    it('rejeita IMEI com dígito verificador inválido', () => {
      assert.equal(isValidImei('356938035643800'), false);
    });

    it('rejeita IMEI curto', () => {
      assert.equal(isValidImei('123'), false);
    });
  });

  describe('normalizeTrackerPhone', () => {
    it('mantém apenas dígitos', () => {
      assert.equal(normalizeTrackerPhone('(11) 98765-4321'), '11987654321');
    });
  });

  describe('isValidTrackerPhone', () => {
    it('aceita chip com DDD (10–13 dígitos)', () => {
      assert.equal(isValidTrackerPhone('5511999999999'), true);
      assert.equal(isValidTrackerPhone('11999999999'), true);
    });

    it('rejeita número curto', () => {
      assert.equal(isValidTrackerPhone('123456789'), false);
    });
  });
});
