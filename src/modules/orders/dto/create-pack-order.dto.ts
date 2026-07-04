import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Pack Core Evolution (Phase 4B) — direct fixed-Pack purchase payload.
 *
 * Carries only customer + delivery fields. The Pack (and therefore its items,
 * references, and price) is identified by the `:packId` route parameter and is
 * expanded/priced entirely server-side — no client-supplied items or prices are
 * ever accepted here.
 */
export class CreatePackOrderDto {
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
