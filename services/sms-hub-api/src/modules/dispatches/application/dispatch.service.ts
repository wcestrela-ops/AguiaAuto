import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
  idempotency_key?: string;
}

const REUSABLE_STATUSES = [
  DispatchStatus.SENT,
  DispatchStatus.ACCEPTED_BY_GATEWAY,
  DispatchStatus.PROCESSING,
  DispatchStatus.QUEUED,
];

@Injectable()
export class DispatchService {
  constructor(
    @InjectRepository(CommandDispatchEntity) private readonly dispatches: Repository<CommandDispatchEntity>,
    private readonly gatewayManager: GatewayManagerService,
  ) {}

  async sendInternal(input: InternalSendInput) {
    const phone = this.normalizePhone(input.phone);
    if (!phone) throw new BadRequestException('Número do chip inválido.');

    if (input.idempotency_key) {
      const existing = await this.dispatches.findOne({
        where: { idempotencyKey: input.idempotency_key },
      });
      if (existing && REUSABLE_STATUSES.includes(existing.status)) {
        return this.toResponse(existing, phone, input.message, true);
      }
    }

    const dispatch = this.dispatches.create({
      phone,
      message: input.message,
      action: input.action || null,
      vehicleId: input.vehicle_id || null,
      userId: input.user_id || null,
      source: input.source || 'aguia',
      idempotencyKey: input.idempotency_key || null,
      status: DispatchStatus.QUEUED,
    });

    try {
      await this.dispatches.save(dispatch);
    } catch (error) {
      if (input.idempotency_key && this.isUniqueViolation(error)) {
        const existing = await this.dispatches.findOne({
          where: { idempotencyKey: input.idempotency_key },
        });
        if (existing) return this.toResponse(existing, phone, input.message, true);
      }
      throw error;
    }

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
        throw new ConflictException(dispatch.errorMessage || 'Falha ao enviar SMS.');
      }

      return this.toResponse(dispatch, phone, input.message, false, gateway.name, gateway.type);
    } catch (error) {
      dispatch.status = DispatchStatus.FAILED;
      dispatch.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await this.dispatches.save(dispatch);
      throw error;
    }
  }

  private toResponse(
    dispatch: CommandDispatchEntity,
    phone: string,
    message: string,
    duplicate: boolean,
    gatewayName?: string,
    gatewayType?: string,
  ) {
    return {
      dispatch_id: dispatch.id,
      status: dispatch.status,
      gateway: gatewayName || null,
      gateway_type: gatewayType || null,
      external_id: dispatch.externalId,
      phone,
      message,
      duplicate,
    };
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private normalizePhone(phone: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits || null;
  }
}
