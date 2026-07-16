import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { GatewayManagerService } from '../../gateways/application/gateway-manager.service';
import { CommandDispatchEntity } from '../infrastructure/command-dispatch.entity';
import { DispatchStatus } from '../../gateways/domain/gateway.enums';

describe('DispatchService', () => {
  let service: DispatchService;

  const stored: CommandDispatchEntity[] = [];

  const dispatchesRepo = {
    create: jest.fn((data) => ({ id: `dispatch-${stored.length + 1}`, ...data })),
    save: jest.fn(async (data) => {
      const idx = stored.findIndex((item) => item.id === data.id);
      if (idx >= 0) stored[idx] = data;
      else stored.push(data);
      return data;
    }),
    findOne: jest.fn(async ({ where }) =>
      stored.find((item) => item.idempotencyKey === where.idempotencyKey) || null,
    ),
  };

  const gatewayManager = {
    selectActiveGateway: jest.fn().mockResolvedValue({
      gateway: { id: 'gw-1', name: 'Gateway Simulado', type: 'FAKE' },
      driver: {
        sendMessage: jest.fn().mockResolvedValue({ status: 'SENT', externalId: 'fake-1' }),
      },
    }),
  };

  beforeEach(async () => {
    stored.length = 0;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: getRepositoryToken(CommandDispatchEntity), useValue: dispatchesRepo },
        { provide: GatewayManagerService, useValue: gatewayManager },
      ],
    }).compile();

    service = module.get(DispatchService);
  });

  it('should send internal dispatch via fake gateway', async () => {
    const result = await service.sendInternal({
      phone: '+55 11 99999-0000',
      message: 'RELAY,0#',
      action: 'desbloquear',
      vehicle_id: '10',
      user_id: '5',
    });

    expect(result.status).toBe(DispatchStatus.SENT);
    expect(result.message).toBe('RELAY,0#');
    expect(result.gateway).toBe('Gateway Simulado');
  });

  it('should return duplicate when idempotency key repeats', async () => {
    const payload = {
      phone: '5511999990000',
      message: 'RELAY,0#',
      action: 'desbloquear',
      idempotency_key: 'same-key',
    };

    const first = await service.sendInternal(payload);
    const second = await service.sendInternal(payload);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.dispatch_id).toBe(first.dispatch_id);
    expect(gatewayManager.selectActiveGateway).toHaveBeenCalledTimes(1);
  });
});
