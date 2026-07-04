import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  optionalBoolean,
  optionalLowercase,
  optionalTrimmedString,
  optionalUppercase,
} from '../../../common/transforms/query.transforms';

export class QueryPublicProductsDto {
  @ApiPropertyOptional({ example: 'foundation' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'FOUNDATION' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({
    example: 'face-serum',
    description: 'Filter by the stable product-type code (kebab-case).',
  })
  @IsOptional()
  @Transform(({ value }) => optionalLowercase(value))
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Minimum base price (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 300,
    description: 'Maximum base price (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 'DRY,MEDIUM',
    description:
      'Comma-separated attribute-option codes. A product matches when each code is present at the product or reference suitability layer (AND across codes).',
  })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  attributeOptions?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'name', 'basePrice'] })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'basePrice'])
  sortBy?: 'createdAt' | 'name' | 'basePrice';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter products with a valid compare-at/original price.',
  })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;
}
