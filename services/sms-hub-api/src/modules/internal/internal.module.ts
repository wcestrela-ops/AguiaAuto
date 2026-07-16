import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandDispatchEntity } from '../dispatches/infrastructure/command-dispatch.entity';
import { SmsGatewayEntity } from '../gateways/infrastructure/sms-gateway.entity';
import { DispatchService } from '../dispatches/application/dispatch.service';
import { GatewayManagerService } from '../gateways/application/gateway-manager.service';
import { InternalDispatchController } from './presentation/internal-dispatch.controller';
import { AguiaServiceGuard } from '../../shared/guards/aguia-service.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CommandDispatchEntity, SmsGatewayEntity])],
  controllers: [InternalDispatchController],
  providers: [DispatchService, GatewayManagerService, AguiaServiceGuard],
  exports: [DispatchService],
})
export class InternalModule {}
