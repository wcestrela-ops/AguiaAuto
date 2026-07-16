import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InternalModule } from './modules/internal/internal.module';
import { CompanyEntity } from './modules/companies/infrastructure/company.entity';
import { UserEntity } from './modules/users/infrastructure/user.entity';
import { UserSessionEntity } from './modules/users/infrastructure/user-session.entity';
import { SmsGatewayEntity } from './modules/gateways/infrastructure/sms-gateway.entity';
import { CommandDispatchEntity } from './modules/dispatches/infrastructure/command-dispatch.entity';
import { GlobalExceptionFilter } from './shared/errors/global-exception.filter';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../../.env.sms-hub', '.env.sms-hub', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: parseInt(process.env.SMS_HUB_RATE_LIMIT || '20', 10),
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.SMS_HUB_DATABASE_URL,
      entities: [
        CompanyEntity,
        UserEntity,
        UserSessionEntity,
        SmsGatewayEntity,
        CommandDispatchEntity,
      ],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    DashboardModule,
    HealthModule,
    InternalModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
