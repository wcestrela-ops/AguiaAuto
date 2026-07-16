import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/domain/user-role.enum';
import { SKIP_COMPANY_GUARD } from '../decorators/skip-company-guard.decorator';

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true;

    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (!user.companyId) {
      throw new ForbiddenException('Usuário sem empresa vinculada.');
    }

    return true;
  }
}
