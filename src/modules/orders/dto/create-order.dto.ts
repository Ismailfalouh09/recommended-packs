import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Recommendation result selected by the customer.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  recommendationResultId: string;

  @ApiProperty({
    description: 'Customer display name for order fulfillment.',
    example: 'Demo Customer',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Customer phone number used to create or reuse a customer.',
    example: '0600000000',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description: 'Optional WhatsApp phone number for future customer contact.',
    example: '0600000000',
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  whatsappPhone?: string;

  @ApiProperty({
    description: 'Delivery city.',
    example: 'Casablanca',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: 'Delivery street/address line.',
    example: 'Maarif',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @ApiPropertyOptional({
    description: 'Additional delivery directions.',
    example: 'Near the pharmacy',
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  extraInfo?: string;

  @ApiPropertyOptional({
    description: 'Optional order note for admin fulfillment.',
    example: 'Call before delivery',
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string;
}
