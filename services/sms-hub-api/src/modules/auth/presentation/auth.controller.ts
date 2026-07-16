import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from '../application/auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/auth/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('bridge')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Bridge — emite JWT SMS a partir do token admin Águia' })
  async bridge(@Headers('x-aguia-admin-token') aguiaToken: string) {
    const data = await this.authService.bridgeAguiaAdmin(aguiaToken || '');
    return { success: true, data, meta: null };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const data = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { success: true, data, meta: null };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const data = await this.authService.refresh(dto);
    return { success: true, data, meta: null };
  }

  @Post('logout')
  async logout(@Body() body: { refresh_token?: string }) {
    const data = await this.authService.logout(body.refresh_token || '');
    return { success: true, data, meta: null };
  }

  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.authService.logoutAll(user.id);
    return { success: true, data, meta: null };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.authService.me(user.id);
    return { success: true, data, meta: null };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword();
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword();
  }
}
