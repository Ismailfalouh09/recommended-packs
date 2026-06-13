import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackStatus, PriceMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  optionalBoolean,
  optionalTrimmedString,
} from '../../../common/transforms/query.transforms';

export class QueryPacksDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'natural' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PackStatus })
  @IsOptional()
  @IsEnum(PackStatus)
  status?: PackStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: PriceMode })
  @IsOptional()
  @IsEnum(PriceMode)
  priceMode?: PriceMode;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'fixedPrice', 'priority'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'fixedPrice', 'priority'])
  sortBy?: 'createdAt' | 'name' | 'fixedPrice' | 'priority';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
