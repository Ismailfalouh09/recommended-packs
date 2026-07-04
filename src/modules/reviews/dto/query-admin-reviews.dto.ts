import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus, ReviewTargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Reviews & Ratings (Phase R3) - admin moderation queue filters.
 */
export class QueryAdminReviewsDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ enum: ReviewTargetType })
  @IsOptional()
  @IsEnum(ReviewTargetType)
  targetType?: ReviewTargetType;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  packId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
