import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentAdmin } from '../types/jwt-payload.type';

export const CurrentAdminUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAdmin | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentAdmin }>();
    return request.user;
  },
);
