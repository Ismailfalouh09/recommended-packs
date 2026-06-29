import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import {
  optionalLowercase,
  optionalTrimmedString,
  optionalUppercase,
} from '../../../common/transforms/query.transforms';

export class CreateProductDto {
  @ApiProperty({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({ example: 'Foundation X' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'foundation-x' })
  @Transform(({ value }) => optionalLowercase(value))
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({
    example: 'face-serum',
    description:
      'Stable lowercase product-type code (kebab-case). Drives required-by-type validation policy and storefront filtering.',
  })
  @IsOptional()
  @Transform(({ value }) => optionalLowercase(value))
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  productType?: string;

  @ApiPropertyOptional({ example: 'Lightweight buildable foundation.' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Demo foundation' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Aqua, Glycerin, Niacinamide.' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  ingredients?: string;

  @ApiPropertyOptional({ example: 'Apply morning and evening to clean skin.' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  directions?: string;

  @ApiProperty({ example: 120 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({
    example: 150,
    description:
      'Original/compare-at price. Must be greater than basePrice to register as on sale.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: 70 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiProperty({ example: 'MAD', default: 'MAD' })
  @Transform(({ value }) => optionalUppercase(value))
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiPropertyOptional({ example: 'Foundation X | Demo Beauty' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Shop Foundation X, a lightweight foundation.' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ example: 'https://example.com/product.jpg' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsUrl()
  mainImageUrl?: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
