import { ApiPropertyOptional } from '@nestjs/swagger';
import { MediaAssetProvider, MediaAssetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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

export class QueryMediaAssetsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'foundation' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: MediaAssetProvider })
  @IsOptional()
  @IsEnum(MediaAssetProvider)
  provider?: MediaAssetProvider;

  @ApiPropertyOptional({ enum: MediaAssetType })
  @IsOptional()
  @IsEnum(MediaAssetType)
  assetType?: MediaAssetType;

  @ApiPropertyOptional({ example: 'recommended-packs/products' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ example: 'PRODUCT_MAIN_IMAGE' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  usageContext?: string;

  @ApiPropertyOptional({ example: 'PRODUCT' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  relatedEntity?: string;

  @ApiPropertyOptional({ example: '00000000-0000-4000-8000-000000000001' })
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'bytes', 'originalName'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'bytes', 'originalName'])
  sortBy?: 'createdAt' | 'updatedAt' | 'bytes' | 'originalName';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
