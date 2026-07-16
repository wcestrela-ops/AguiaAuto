import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { UserEntity } from '../../users/infrastructure/user.entity';
import { UserSessionEntity } from '../../users/infrastructure/user-session.entity';
import { UserRole, UserStatus } from '../../users/domain/user-role.enum';
import { JwtPayload } from '../../../shared/auth/jwt-payload.interface';
import { LoginDto, RefreshDto } from '../presentation/dto/auth.dto';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity) private readonly sessions: Repository<UserSessionEntity>,
    private readonly jwt: JwtService,
  ) {}

  async bridgeAguiaAdmin(aguiaToken: string) {
    const bridgeSecret =
      process.env.AGUIA_ADMIN_SECRET ||
      process.env.SMS_HUB_AGUIA_BRIDGE_SECRET ||
      '';

    if (!bridgeSecret || aguiaToken !== bridgeSecret) {
      throw new UnauthorizedException('Token administrativo Águia inválido.');
    }

    const adminEmail = process.env.SMS_HUB_ADMIN_EMAIL || 'admin@agsmshub.local';
    const user = await this.users.findOne({
      where: { email: adminEmail, role: UserRole.SUPER_ADMIN },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Administrador SMS Hub não configurado.');
    }

    return this.issueTokens(user, {});
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const user = await this.users.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas.');

    return this.issueTokens(user, meta);
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = hashToken(dto.refresh_token);
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: tokenHash, revokedAt: IsNull() },
      relations: ['user'],
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    session.revokedAt = new Date();
    await this.sessions.save(session);

    return this.issueTokens(session.user, {
      userAgent: session.userAgent || undefined,
      ip: session.ipAddress || undefined,
    });
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };
    const tokenHash = hashToken(refreshToken);
    await this.sessions.update(
      { refreshTokenHash: tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    return this.sanitizeUser(user);
  }

  forgotPassword() {
    throw new NotImplementedException('Recuperação de senha será implementada na próxima fase.');
  }

  resetPassword() {
    throw new NotImplementedException('Recuperação de senha será implementada na próxima fase.');
  }

  private async issueTokens(user: UserEntity, meta: { userAgent?: string; ip?: string }) {
    const session = this.sessions.create({
      userId: user.id,
      refreshTokenHash: '',
      expiresAt: new Date(Date.now() + this.refreshDays() * 86400000),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ip || null,
    });
    await this.sessions.save(session);

    const refreshToken = randomBytes(48).toString('hex');
    session.refreshTokenHash = hashToken(refreshToken);
    await this.sessions.save(session);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      sessionId: session.id,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.SMS_HUB_JWT_ACCESS_EXPIRES || '1h',
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: UserEntity) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.companyId,
      status: user.status,
    };
  }

  private refreshDays() {
    return parseInt(process.env.SMS_HUB_JWT_REFRESH_DAYS || '7', 10);
  }
}
