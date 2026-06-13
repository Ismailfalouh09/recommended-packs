import { AdminRole } from '@prisma/client';

export function validateRoleAccess(
  allowedRoles: AdminRole[],
  actualRole: AdminRole,
) {
  return allowedRoles.includes(actualRole);
}
