import * as bcrypt from 'bcryptjs';
import dataSource from './data-source';
import { CompanyEntity } from '../../modules/companies/infrastructure/company.entity';
import { UserEntity } from '../../modules/users/infrastructure/user.entity';
import { UserRole, UserStatus, CompanyStatus } from '../../modules/users/domain/user-role.enum';
import { SmsGatewayEntity } from '../../modules/gateways/infrastructure/sms-gateway.entity';
import { GatewayStatus, GatewayType } from '../../modules/gateways/domain/gateway.enums';

async function seed() {
  await dataSource.initialize();

  const companyRepo = dataSource.getRepository(CompanyEntity);
  const userRepo = dataSource.getRepository(UserEntity);
  const gatewayRepo = dataSource.getRepository(SmsGatewayEntity);

  let company = await companyRepo.findOne({ where: { name: 'Empresa Teste' } });
  if (!company) {
    company = await companyRepo.save(
      companyRepo.create({
        name: 'Empresa Teste',
        description: 'Empresa de demonstração AG SMS Hub',
        status: CompanyStatus.ACTIVE,
      }),
    );
    console.log('Empresa Teste criada.');
  }

  const adminEmail = process.env.SMS_HUB_ADMIN_EMAIL || 'admin@agsmshub.local';
  const adminPassword = process.env.SMS_HUB_ADMIN_PASSWORD || 'admin123456';
  const operatorEmail = process.env.SMS_HUB_OPERATOR_EMAIL || 'operador@empresa.local';
  const operatorPassword = process.env.SMS_HUB_OPERATOR_PASSWORD || 'operador123456';

  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        name: 'Administrador',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: UserRole.SUPER_ADMIN,
        companyId: null,
        status: UserStatus.ACTIVE,
      }),
    );
    console.log(`Super admin criado: ${adminEmail}`);
  }

  let operator = await userRepo.findOne({ where: { email: operatorEmail } });
  if (!operator) {
    operator = await userRepo.save(
      userRepo.create({
        name: 'Operador Teste',
        email: operatorEmail,
        passwordHash: await bcrypt.hash(operatorPassword, 12),
        role: UserRole.COMPANY_USER,
        companyId: company.id,
        status: UserStatus.ACTIVE,
      }),
    );
    console.log(`Operador criado: ${operatorEmail}`);
  }

  let gateway = await gatewayRepo.findOne({ where: { name: 'Gateway Simulado' } });
  if (!gateway) {
    gateway = await gatewayRepo.save(
      gatewayRepo.create({
        name: 'Gateway Simulado',
        type: GatewayType.FAKE,
        priority: 1,
        active: true,
        status: GatewayStatus.ONLINE,
      }),
    );
    console.log('Gateway FAKE criado.');
  }

  console.log(`SMS_HUB_DEFAULT_COMPANY_ID=${company.id}`);

  await dataSource.destroy();
  console.log('Seed concluído.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
