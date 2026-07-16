import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { DispatchService } from '../../dispatches/application/dispatch.service';
import { InternalSendDto } from './internal-send.dto';
import { AguiaServiceGuard } from '../../../shared/guards/aguia-service.guard';

@ApiTags('internal')
@Controller('internal/dispatches')
@UseGuards(AguiaServiceGuard, ThrottlerGuard)
export class InternalDispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('send')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envio interno Águia → SMS (failover 4G)' })
  async send(
    @Body() dto: InternalSendDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const data = await this.dispatchService.sendInternal({
      ...dto,
      idempotency_key: idempotencyKey || dto.idempotency_key,
    });
    return { success: true, data, meta: null };
  }
}
