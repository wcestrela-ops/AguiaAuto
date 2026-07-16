import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandDispatchEntity } from './infrastructure/command-dispatch.entity';
import { DispatchService } from './application/dispatch.service';
import { GatewayManagerService } from '../gateways/application/gateway-manager.service';
import { SmsGatewayEntity } from '../gateways/infrastructure/sms-gateway.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommandDispatchEntity, SmsGatewayEntity])],
  providers: [DispatchService, GatewayManagerService],
  exports: [DispatchService, GatewayManagerService],
})
export class DispatchModule {}
