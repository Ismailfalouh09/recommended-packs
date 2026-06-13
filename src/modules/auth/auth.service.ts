import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CurrentAdmin, JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly unauthorizedMessage = 'Invalid email or password.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException(this.unauthorizedMessage);
    }

    const passwordIsValid = await bcrypt.compare(
      loginDto.password,
      admin.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException(this.unauthorizedMessage);
    }

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') ?? '8h';
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    });

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async getCurrentAdmin(currentAdmin: CurrentAdmin) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: currentAdmin.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        lastLoginAt: true,
        isActive: true,
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Authentication required.');
    }

    return {
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    };
  }
}
