import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CartOrderItemDto {
  @ApiProperty({
    description: 'Product being ordered from the normal store cart.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Selected product reference or variant.',
    example: '00000000-0000-4000-8000-000000000002',
  })
  @IsUUID()
  referenceId: string;

  @ApiProperty({
    description: 'Quantity requested for this cart line.',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateCartOrderDto {
  @ApiProperty({
    description: 'Normal store cart lines selected by the customer.',
    type: [CartOrderItemDto],
    example: [
      {
        productId: '00000000-0000-4000-8000-000000000001',
        referenceId: '00000000-0000-4000-8000-000000000002',
        quantity: 2,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CartOrderItemDto)
  items: CartOrderItemDto[];

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
