import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  optionalTrimmedString,
  optionalUppercase,
} from '../../../common/transforms/query.transforms';
import { ReferenceAttributeInputDto } from './reference-attribute-input.dto';

export class CreateProductReferenceDto {
  @ApiProperty({ example: 'RF2' })
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  @IsNotEmpty()
  referenceCode!: string;

  @ApiProperty({ example: 'Medium Warm' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  referenceName!: string;

  @ApiPropertyOptional({
    example: 'Medium Warm',
    description: 'Structured shade identity (augments referenceName).',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  shadeName?: string | null;

  @ApiPropertyOptional({ example: 'N20' })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  shadeCode?: string | null;

  @ApiPropertyOptional({
    example: '#E8B98C',
    description: 'Hex colour for swatch UI (#RRGGBB).',
  })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @Matches(/^#[0-9A-F]{6}$/, {
    message: 'swatchHex must be a #RRGGBB hex colour.',
  })
  swatchHex?: string | null;

  @ApiPropertyOptional({ example: '45ml' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  measurement?: string | null;

  @ApiPropertyOptional({
    enum: VariationType,
    description: 'Single variation axis for this reference.',
  })
  @IsOptional()
  @IsEnum(VariationType)
  variationType?: VariationType | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'FOUNDATION-X-RF2' })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceOverride?: number | null;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceDelta?: number;

  @ApiPropertyOptional({ example: 'https://example.com/reference.jpg' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsUrl()
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 20, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reservedQuantity?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ReferenceAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceAttributeInputDto)
  attributes?: ReferenceAttributeInputDto[];
}
