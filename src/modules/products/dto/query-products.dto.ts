import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  optionalBoolean,
  optionalTrimmedString,
} from '../../../common/transforms/query.transforms';

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'foundation' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['createdAt', 'name', 'basePrice'] })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'basePrice'])
  sortBy?: 'createdAt' | 'name' | 'basePrice';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
