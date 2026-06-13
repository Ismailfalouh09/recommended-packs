import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as Reflector);
  });

  it('permits an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.OWNER]);

    expect(guard.canActivate(contextWithRole(AdminRole.OWNER))).toBe(true);
  });

  it('rejects a forbidden role', () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.OWNER]);

    expect(guard.canActivate(contextWithRole(AdminRole.STAFF))).toBe(false);
  });

  it('allows access when no roles are declared', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextWithRole(AdminRole.STAFF))).toBe(true);
  });
});

function contextWithRole(role: AdminRole): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          role,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}
