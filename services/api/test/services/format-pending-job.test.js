const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatPendingJob } = require('../../src/services/installer-service');

const BASE_ROW = {
  id: 10,
  plate: 'ABC1D23',
  brand: 'Fiat',
  model: 'Uno',
  color: 'Branco',
  year: 2020,
  status: 'pending_installation',
  tracker_device_id: null,
  tracker_name: null,
  user_id: 5,
  user_name: 'João',
  user_email: 'joao@test.com',
  user_phone: '5511999999999',
  created_at: '2026-01-01T00:00:00Z',
};

describe('formatPendingJob', () => {
  it('monta label a partir de marca, modelo e placa', () => {
    const job = formatPendingJob(BASE_ROW, 1);
    assert.equal(job.label, 'Fiat · Uno · ABC1D23');
  });

  it('marca pool quando não há instalador atribuído', () => {
    const job = formatPendingJob({ ...BASE_ROW, assigned_installer_id: null }, 1);
    assert.equal(job.is_pool, true);
    assert.equal(job.assigned_to_me, true);
    assert.equal(job.can_finalize, true);
  });

  it('bloqueia finalização para instalador não atribuído', () => {
    const job = formatPendingJob({ ...BASE_ROW, assigned_installer_id: 2 }, 1);
    assert.equal(job.is_pool, false);
    assert.equal(job.assigned_to_me, false);
    assert.equal(job.can_finalize, false);
  });

  it('permite finalização quando atribuído ao instalador logado', () => {
    const job = formatPendingJob({ ...BASE_ROW, assigned_installer_id: 1 }, 1);
    assert.equal(job.assigned_to_me, true);
    assert.equal(job.can_finalize, true);
  });
});
