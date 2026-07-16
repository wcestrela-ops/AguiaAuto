import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AguiaServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-aguia-service-secret'];
    const expected =
      process.env.AGUIA_SERVICE_SECRET ||
      process.env.AGUIA_ADMIN_SECRET ||
      process.env.SMS_HUB_AGUIA_BRIDGE_SECRET ||
      '';

    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Serviço Águia não autorizado.');
    }

    return true;
  }
}
