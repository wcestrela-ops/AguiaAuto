import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/infrastructure/user.entity';
import { UserSessionEntity } from '../../users/infrastructure/user-session.entity';
import { UserStatus } from '../../users/domain/user-role.enum';
import { JwtPayload, AuthenticatedUser } from '../../../shared/auth/jwt-payload.interface';

function jwtSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.SMS_HUB_JWT_SECRET) {
    throw new Error('SMS_HUB_JWT_SECRET é obrigatório em produção.');
  }
  return process.env.SMS_HUB_JWT_SECRET || 'dev-secret-change-me';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity) private readonly sessions: Repository<UserSessionEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const session = await this.sessions.findOne({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Sessão revogada.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      sessionId: session.id,
    };
  }
}
