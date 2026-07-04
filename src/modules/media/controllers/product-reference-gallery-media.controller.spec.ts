import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ProductReferenceGalleryMediaController } from './product-reference-gallery-media.controller';

/**
 * Media Management (Task 14) — authorization policy for the reference gallery
 * admin routes. Reads are open to OWNER/ADMIN/STAFF; every mutation is
 * restricted to OWNER/ADMIN.
 */
describe('ProductReferenceGalleryMediaController auth policy', () => {
  const proto = ProductReferenceGalleryMediaController.prototype;

  it('rejects unauthenticated requests to a write route', () => {
    const guard = new RolesGuard(reflectorFor(proto.upload));
    expect(guard.canActivate(contextWithoutAdmin())).toBe(false);
  });

  it('allows OWNER, ADMIN, and STAFF to read the gallery', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, proto.list);
    expect(roles).toEqual([
      AdminRole.OWNER,
      AdminRole.ADMIN,
      AdminRole.STAFF,
    ]);
  });

  it.each([
    ['upload', () => proto.upload],
    ['reorder', () => proto.reorder],
    ['setPrimary', () => proto.setPrimary],
    ['update', () => proto.update],
    ['delete', () => proto.delete],
  ])('restricts %s to OWNER and ADMIN only', (_name, handler) => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler());
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
