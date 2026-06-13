import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthLoginResponse,
  CurrentAdminResponse,
} from '../../common/swagger/api-response.models';
import { CurrentAdminUser } from './decorators/current-admin.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import type { CurrentAdmin } from './types/jwt-payload.type';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Log in as an admin user',
    description: 'Returns a bearer JWT for an active admin account.',
  })
  @ApiOkResponse({
    description: 'Admin login succeeded.',
    type: AuthLoginResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get current authenticated admin',
    description: 'Returns the active admin represented by the bearer token.',
  })
  @ApiOkResponse({
    description: 'Current admin identity.',
    type: CurrentAdminResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  me(@CurrentAdminUser() currentAdmin: CurrentAdmin) {
    return this.authService.getCurrentAdmin(currentAdmin);
  }
}
