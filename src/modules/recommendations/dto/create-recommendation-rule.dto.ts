import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RecommendationConditionType,
  RecommendationTargetType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import {
  optionalTrimmedString,
  optionalUpperSnake,
} from '../../../common/transforms/query.transforms';

export class CreateRecommendationRuleDto {
  @ApiProperty({ example: 'COVERAGE_MATCH' })
  @Transform(({ value }) => optionalUpperSnake(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @ApiProperty({ example: 'Coverage match' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: RecommendationTargetType })
  @IsEnum(RecommendationTargetType)
  targetType!: RecommendationTargetType;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  attributeGroupId?: string | null;

  @ApiProperty({ enum: RecommendationConditionType })
  @IsEnum(RecommendationConditionType)
  conditionType!: RecommendationConditionType;

  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsInt()
  scoreValue!: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  weight?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
