import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserEntity } from '../../users/infrastructure/user.entity';
import { UserSessionEntity } from '../../users/infrastructure/user-session.entity';
import { UserRole, UserStatus } from '../../users/domain/user-role.enum';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser: UserEntity = {
    id: 'user-1',
    companyId: null,
    company: null,
    name: 'Admin',
    email: 'admin@test.local',
    passwordHash: '',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessions: [],
  };

  const usersRepo = {
    findOne: jest.fn(),
  };

  const sessionsRepo = {
    create: jest.fn((data) => ({ id: 'session-1', ...data })),
    save: jest.fn(async (data) => data),
    update: jest.fn(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('secret123', 12);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: usersRepo },
        { provide: getRepositoryToken(UserSessionEntity), useValue: sessionsRepo },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('access-token') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should login with valid credentials', async () => {
    usersRepo.findOne.mockResolvedValue(mockUser);
    const result = await service.login(
      { email: 'admin@test.local', password: 'secret123' },
      { ip: '127.0.0.1' },
    );
    expect(result.access_token).toBe('access-token');
    expect(result.user.email).toBe('admin@test.local');
  });

  it('should reject invalid password', async () => {
    usersRepo.findOne.mockResolvedValue(mockUser);
    await expect(
      service.login({ email: 'admin@test.local', password: 'wrong' }, {}),
    ).rejects.toThrow('Credenciais inválidas');
  });

  it('should bridge aguia admin token', async () => {
    process.env.AGUIA_ADMIN_SECRET = 'aguia-admin-secret';
    usersRepo.findOne.mockResolvedValue(mockUser);
    const result = await service.bridgeAguiaAdmin('aguia-admin-secret');
    expect(result.access_token).toBe('access-token');
    delete process.env.AGUIA_ADMIN_SECRET;
  });

  it('should reject invalid aguia bridge token', async () => {
    process.env.AGUIA_ADMIN_SECRET = 'aguia-admin-secret';
    await expect(service.bridgeAguiaAdmin('wrong')).rejects.toThrow(
      'Token administrativo Águia inválido',
    );
    delete process.env.AGUIA_ADMIN_SECRET;
  });
});
