const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  cell,
  exportFilename,
  formatMoneyBr,
} = require('../../src/lib/export/formatters');

describe('export formatters', () => {
  it('cell formata booleanos', () => {
    assert.equal(cell(true), 'Sim');
    assert.equal(cell(false), 'Não');
    assert.equal(cell(null), '');
  });

  it('exportFilename inclui data e extensão', () => {
    assert.match(exportFilename('veiculos', 'xlsx'), /^veiculos-\d{4}-\d{2}-\d{2}\.xlsx$/);
    assert.match(exportFilename('veiculos', 'pdf'), /\.pdf$/);
  });

  it('formatMoneyBr formata BRL', () => {
    assert.match(formatMoneyBr(99.9), /R\$/);
  });
});
