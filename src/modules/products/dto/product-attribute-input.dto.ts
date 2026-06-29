import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { optionalUppercase } from '../../../common/transforms/query.transforms';

/**
 * Product-level suitability assignment (Phase 5.3/5.5). Mirrors the
 * reference-level shape but is only valid for attribute groups flagged
 * `isProductAttribute = true` (general suitability: skin type / concern /
 * finish). The product/reference split is enforced in the service, not the DB.
 */
export class ProductAttributeInputDto {
  @ApiProperty({ example: 'SKIN_TYPE' })
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  @IsNotEmpty()
  attributeGroupCode!: string;

  @ApiProperty({ example: 'DRY' })
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  @IsNotEmpty()
  attributeOptionCode!: string;

  @ApiProperty({ enum: MatchType, example: MatchType.COMPATIBLE })
  @IsEnum(MatchType)
  matchType!: MatchType;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsInt()
  scoreValue!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHardFilter?: boolean;
}
