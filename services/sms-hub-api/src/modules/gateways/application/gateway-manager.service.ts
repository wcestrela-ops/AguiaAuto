import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsGatewayEntity } from '../infrastructure/sms-gateway.entity';
import { createGatewayDriver } from '../infrastructure/gateway-drivers';
import { GatewayType } from '../domain/gateway.enums';

@Injectable()
export class GatewayManagerService {
  constructor(
    @InjectRepository(SmsGatewayEntity) private readonly gateways: Repository<SmsGatewayEntity>,
  ) {}

  async selectActiveGateway() {
    const gateway = await this.gateways.findOne({
      where: { active: true },
      order: { priority: 'ASC' },
    });

    if (!gateway) {
      throw new Error('Nenhum gateway SMS ativo configurado.');
    }

    const driver = createGatewayDriver(gateway.type as GatewayType, gateway.name);
    const available = await driver.checkAvailability();
    if (!available) {
      throw new Error(`Gateway ${gateway.name} indisponível.`);
    }

    return { gateway, driver };
  }
}
