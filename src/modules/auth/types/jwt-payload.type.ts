import { AdminRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
}

export interface CurrentAdmin {
  id: string;
  email: string;
  role: AdminRole;
}
