import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CompanyGuard } from '../../shared/guards/company.guard';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [RolesGuard, CompanyGuard],
})
export class DashboardModule {}
