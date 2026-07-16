import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { secretsMatch } from '../config/env';

@Injectable()
export class AguiaServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = String(request.headers['x-aguia-service-secret'] || '');
    const expected = process.env.AGUIA_SERVICE_SECRET || '';

    if (!expected) {
      throw new UnauthorizedException('AGUIA_SERVICE_SECRET não configurado no SMS Hub.');
    }

    if (!secretsMatch(provided, expected)) {
      throw new UnauthorizedException('Serviço Águia não autorizado.');
    }

    return true;
  }
}
