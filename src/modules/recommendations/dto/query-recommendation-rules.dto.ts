import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RecommendationConditionType,
  RecommendationTargetType,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  optionalBoolean,
  optionalTrimmedString,
} from '../../../common/transforms/query.transforms';

export class QueryRecommendationRulesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'skin' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RecommendationTargetType })
  @IsOptional()
  @IsEnum(RecommendationTargetType)
  targetType?: RecommendationTargetType;

  @ApiPropertyOptional({ enum: RecommendationConditionType })
  @IsOptional()
  @IsEnum(RecommendationConditionType)
  conditionType?: RecommendationConditionType;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  attributeGroupId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
