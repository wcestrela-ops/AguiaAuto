import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/infrastructure/user.entity';
import { UserSessionEntity } from '../users/infrastructure/user-session.entity';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtStrategy } from './infrastructure/jwt.strategy';

function jwtSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.SMS_HUB_JWT_SECRET) {
    throw new Error('SMS_HUB_JWT_SECRET é obrigatório em produção.');
  }
  return process.env.SMS_HUB_JWT_SECRET || 'dev-secret-change-me';
}

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserSessionEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: {
        expiresIn: process.env.SMS_HUB_JWT_ACCESS_EXPIRES || '1h',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
