import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [RolesGuard],
})
export class DashboardModule {}
