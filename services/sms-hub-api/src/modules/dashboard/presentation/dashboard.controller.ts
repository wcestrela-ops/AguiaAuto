import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/jwt-payload.interface';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { UserRole } from '../../users/domain/user-role.enum';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  @Get()
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.role === UserRole.SUPER_ADMIN;
    return {
      success: true,
      data: isAdmin
        ? {
            role: user.role,
            empresas: 1,
            usuarios: 2,
            dispositivos: 0,
            envios_hoje: 0,
            gateways_online: 0,
            fila: 0,
          }
        : {
            role: user.role,
            company_id: user.companyId,
            dispositivos: 0,
            dispositivos_ativos: 0,
            sms_hoje: 0,
            em_processamento: 0,
            falhas_recentes: 0,
          },
      meta: null,
    };
  }
}
