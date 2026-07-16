import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandDispatchEntity } from '../infrastructure/command-dispatch.entity';
import { GatewayManagerService } from '../../gateways/application/gateway-manager.service';
import { DispatchStatus } from '../../gateways/domain/gateway.enums';
import { DispatchQueueService } from '../../../shared/queue/dispatch-queue.service';

export interface InternalSendInput {
  phone: string;
  message: string;
  action?: string;
  vehicle_id?: string;
  user_id?: string;
  source?: string;
  idempotency_key?: string;
  company_id?: string;
}

const REUSABLE_STATUSES = [
  DispatchStatus.SENT,
  DispatchStatus.ACCEPTED_BY_GATEWAY,
  DispatchStatus.PROCESSING,
  DispatchStatus.QUEUED,
];

@Injectable()
export class DispatchService {
  private queueService: DispatchQueueService | null = null;

  constructor(
    @InjectRepository(CommandDispatchEntity) private readonly dispatches: Repository<CommandDispatchEntity>,
    private readonly gatewayManager: GatewayManagerService,
  ) {}

  setQueueService(queue: DispatchQueueService) {
    this.queueService = queue;
  }

  async sendInternal(input: InternalSendInput) {
    const phone = this.normalizePhone(input.phone);
    if (!phone) throw new BadRequestException('Número do chip inválido.');

    const companyId = input.company_id || process.env.SMS_HUB_DEFAULT_COMPANY_ID || null;

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
      companyId,
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

    if (this.queueService?.isReady()) {
      const enqueued = await this.queueService.enqueue(dispatch.id);
      if (!enqueued) {
        await this.processDispatch(dispatch.id);
      }
    } else {
      await this.processDispatch(dispatch.id);
    }

    const fresh = await this.dispatches.findOne({ where: { id: dispatch.id } });
    return this.toResponse(fresh!, phone, input.message, false);
  }

  async processDispatch(dispatchId: string) {
    const dispatch = await this.dispatches.findOne({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Dispatch não encontrado.');

    if ([DispatchStatus.SENT, DispatchStatus.ACCEPTED_BY_GATEWAY].includes(dispatch.status)) {
      return dispatch;
    }

    dispatch.status = DispatchStatus.PROCESSING;
    await this.dispatches.save(dispatch);

    try {
      const { gateway, driver } = await this.gatewayManager.selectActiveGateway();
      const result = await driver.sendMessage({ phone: dispatch.phone, message: dispatch.message });

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
      return dispatch;
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
    gatewayName?: string | null,
    gatewayType?: string | null,
  ) {
    return {
      dispatch_id: dispatch.id,
      status: dispatch.status,
      gateway: gatewayName ?? null,
      gateway_type: gatewayType ?? null,
      external_id: dispatch.externalId,
      phone,
      message,
      duplicate,
      company_id: dispatch.companyId,
      queued: dispatch.status === DispatchStatus.QUEUED || dispatch.status === DispatchStatus.PROCESSING,
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
