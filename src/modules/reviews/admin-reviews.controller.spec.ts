import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminReviewsController } from './admin-reviews.controller';

describe('AdminReviewsController auth policy', () => {
  it('rejects non-admin requests for review moderation routes', () => {
    const guard = new RolesGuard(
      reflectorFor(AdminReviewsController.prototype.moderate),
    );

    expect(guard.canActivate(contextWithoutAdmin())).toBe(false);
  });

  it('keeps review moderation writable by OWNER and ADMIN only', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AdminReviewsController.prototype.moderate,
    );

    expect(roles).toEqual([AdminRole.OWNER, AdminRole.ADMIN]);
    expect(roles).not.toContain(AdminRole.STAFF);
  });
});

function reflectorFor(handler: unknown): Reflector {
  return {
    getAllAndOverride: jest.fn(() => Reflect.getMetadata(ROLES_KEY, handler)),
  } as unknown as Reflector;
}

function contextWithoutAdmin(): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
  } as unknown as ExecutionContext;
}
