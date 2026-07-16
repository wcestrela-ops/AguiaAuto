import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DispatchService } from '../../dispatches/application/dispatch.service';
import { InternalSendDto } from './internal-send.dto';
import { AguiaServiceGuard } from '../../../shared/guards/aguia-service.guard';

@ApiTags('internal')
@Controller('internal/dispatches')
@UseGuards(AguiaServiceGuard)
export class InternalDispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('send')
  @ApiOperation({ summary: 'Envio interno Águia → SMS (failover 4G)' })
  async send(@Body() dto: InternalSendDto) {
    const data = await this.dispatchService.sendInternal(dto);
    return { success: true, data, meta: null };
  }
}
