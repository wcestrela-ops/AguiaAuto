import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { CompanyEntity } from '../../modules/companies/infrastructure/company.entity';
import { UserEntity } from '../../modules/users/infrastructure/user.entity';
import { UserSessionEntity } from '../../modules/users/infrastructure/user-session.entity';
import { SmsGatewayEntity } from '../../modules/gateways/infrastructure/sms-gateway.entity';
import { CommandDispatchEntity } from '../../modules/dispatches/infrastructure/command-dispatch.entity';
import { Init1730000000001 } from './migrations/1730000000001-Init';
import { DispatchesGateways1730000000002 } from './migrations/1730000000002-DispatchesGateways';

config({ path: resolve(__dirname, '../../../../.env.sms-hub') });
config({ path: resolve(__dirname, '../../../.env.sms-hub') });
config();

export default new DataSource({
  type: 'postgres',
  url: process.env.SMS_HUB_DATABASE_URL,
  entities: [
    CompanyEntity,
    UserEntity,
    UserSessionEntity,
    SmsGatewayEntity,
    CommandDispatchEntity,
  ],
  migrations: [Init1730000000001, DispatchesGateways1730000000002],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
