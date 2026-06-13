import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description:
      'Admin email address configured for the local/backend environment.',
    example: 'admin@example.com',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Admin password. Never use a real password in examples or shared docs.',
    example: 'change-this-password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
