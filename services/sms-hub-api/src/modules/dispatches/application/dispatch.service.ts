import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandDispatchEntity } from '../infrastructure/command-dispatch.entity';
import { GatewayManagerService } from '../../gateways/application/gateway-manager.service';
import { DispatchStatus } from '../../gateways/domain/gateway.enums';

export interface InternalSendInput {
  phone: string;
  message: string;
  action?: string;
  vehicle_id?: string;
  user_id?: string;
  source?: string;
}

@Injectable()
export class DispatchService {
  constructor(
    @InjectRepository(CommandDispatchEntity) private readonly dispatches: Repository<CommandDispatchEntity>,
    private readonly gatewayManager: GatewayManagerService,
  ) {}

  async sendInternal(input: InternalSendInput) {
    const phone = this.normalizePhone(input.phone);
    if (!phone) throw new Error('Número do chip inválido.');

    const dispatch = await this.dispatches.save(
      this.dispatches.create({
        phone,
        message: input.message,
        action: input.action || null,
        vehicleId: input.vehicle_id || null,
        userId: input.user_id || null,
        source: input.source || 'aguia',
        status: DispatchStatus.QUEUED,
      }),
    );

    dispatch.status = DispatchStatus.PROCESSING;
    await this.dispatches.save(dispatch);

    try {
      const { gateway, driver } = await this.gatewayManager.selectActiveGateway();
      const result = await driver.sendMessage({ phone, message: input.message });

      dispatch.gatewayId = gateway.id;
      dispatch.externalId = result.externalId || null;

      if (result.status === 'SENT') {
        dispatch.status = DispatchStatus.SENT;
      } else if (result.status === 'FAILED') {
        dispatch.status = DispatchStatus.FAILED;
        dispatch.errorMessage = result.error || 'Falha no gateway.';
      } else {
        dispatch.status = DispatchStatus.ACCEPTED_BY_GATEWAY;
      }

      await this.dispatches.save(dispatch);

      if (dispatch.status === DispatchStatus.FAILED) {
        throw new Error(dispatch.errorMessage || 'Falha ao enviar SMS.');
      }

      return {
        dispatch_id: dispatch.id,
        status: dispatch.status,
        gateway: gateway.name,
        gateway_type: gateway.type,
        external_id: dispatch.externalId,
        phone,
        message: input.message,
      };
    } catch (error) {
      dispatch.status = DispatchStatus.FAILED;
      dispatch.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await this.dispatches.save(dispatch);
      throw error;
    }
  }

  private normalizePhone(phone: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits || null;
  }
}
