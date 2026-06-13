import { UnauthorizedException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      adminUser: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_EXPIRES_IN') {
          return '8h';
        }

        return undefined;
      }),
    };
    service = new AuthService(prisma, jwtService, configService);
  });

  it('logs in successfully', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash }),
    );
    prisma.adminUser.update.mockResolvedValue({});

    const result = await service.login({
      email: 'admin@example.com',
      password: 'secret',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe('8h');
    expect(result.admin).toEqual({
      id: 'admin-1',
      fullName: 'Store Owner',
      email: 'admin@example.com',
      role: AdminRole.OWNER,
    });
  });

  it('normalizes email before lookup', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash }),
    );
    prisma.adminUser.update.mockResolvedValue({});

    await service.login({
      email: '  ADMIN@EXAMPLE.COM  ',
      password: 'secret',
    });

    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@example.com' },
      }),
    );
  });

  it('rejects invalid email DTO validation', async () => {
    const dto = Object.assign(new LoginDto(), {
      email: 'not-an-email',
      password: 'secret',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects invalid password', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash }),
    );

    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive admin login', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash, isActive: false }),
    );

    await expect(
      service.login({ email: 'admin@example.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not include passwordHash in JWT payload', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash }),
    );
    prisma.adminUser.update.mockResolvedValue({});

    await service.login({ email: 'admin@example.com', password: 'secret' });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: AdminRole.OWNER,
      },
      expect.any(Object),
    );
    expect(JSON.stringify(jwtService.signAsync.mock.calls[0][0])).not.toContain(
      'passwordHash',
    );
  });

  it('updates lastLoginAt after successful login', async () => {
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.adminUser.findUnique.mockResolvedValue(
      adminFixture({ passwordHash }),
    );
    prisma.adminUser.update.mockResolvedValue({});

    await service.login({ email: 'admin@example.com', password: 'secret' });

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('returns current admin for active admin', async () => {
    const lastLoginAt = new Date('2026-06-12T12:00:00.000Z');
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      fullName: 'Store Owner',
      email: 'admin@example.com',
      role: AdminRole.OWNER,
      lastLoginAt,
      isActive: true,
    });

    await expect(
      service.getCurrentAdmin({
        id: 'admin-1',
        email: 'admin@example.com',
        role: AdminRole.OWNER,
      }),
    ).resolves.toEqual({
      id: 'admin-1',
      fullName: 'Store Owner',
      email: 'admin@example.com',
      role: AdminRole.OWNER,
      lastLoginAt,
    });
  });

  it('rejects inactive current admin', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      fullName: 'Store Owner',
      email: 'admin@example.com',
      role: AdminRole.OWNER,
      lastLoginAt: null,
      isActive: false,
    });

    await expect(
      service.getCurrentAdmin({
        id: 'admin-1',
        email: 'admin@example.com',
        role: AdminRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function adminFixture(
  overrides: Partial<{
    passwordHash: string;
    isActive: boolean;
  }> = {},
) {
  return {
    id: 'admin-1',
    fullName: 'Store Owner',
    email: 'admin@example.com',
    passwordHash: overrides.passwordHash ?? 'hash',
    role: AdminRole.OWNER,
    isActive: overrides.isActive ?? true,
  };
}
