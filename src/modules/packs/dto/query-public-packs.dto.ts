import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PackExperienceLevel,
  PackOccasion,
  PackTier,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  optionalBoolean,
  optionalTrimmedString,
} from '../../../common/transforms/query.transforms';

/**
 * Pack Core Evolution (Phase 4A) — public catalog discovery filters for
 * `GET /packs`. Every field is optional and additive: when no query parameters
 * are supplied the endpoint preserves its legacy behavior (a plain array of
 * active packs). When any filter/pagination param is supplied the endpoint
 * returns a paginated envelope (`{ data, pagination }`).
 */
export const PUBLIC_PACK_SORTS = [
  'featured',
  'newest',
  'price_asc',
  'price_desc',
  'priority',
  'name',
] as const;

export type PublicPackSort = (typeof PUBLIC_PACK_SORTS)[number];

export class QueryPublicPacksDto {
  @ApiPropertyOptional({
    description: 'Filter by Category code (case-insensitive).',
    example: 'FACE',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: PackTier })
  @IsOptional()
  @IsEnum(PackTier)
  tier?: PackTier;

  @ApiPropertyOptional({ enum: PackOccasion })
  @IsOptional()
  @IsEnum(PackOccasion)
  occasion?: PackOccasion;

  @ApiPropertyOptional({ enum: PackExperienceLevel })
  @IsOptional()
  @IsEnum(PackExperienceLevel)
  experienceLevel?: PackExperienceLevel;

  @ApiPropertyOptional({
    description: 'When true, only customizable Packs; when false, only fixed.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  customizable?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by browsing availability. true = only Packs available now; false = only unavailable.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  availableNow?: boolean;

  @ApiPropertyOptional({
    description: 'When true, only featured Packs.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Match Packs carrying any of these tags. Repeat the param or pass a comma-separated list.',
    example: ['bridal', 'glam'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .map((tag) => optionalTrimmedString(tag))
        .filter((tag): tag is string => typeof tag === 'string');
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Free-text search over name, slug, keywords, and description.',
    example: 'natural',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PUBLIC_PACK_SORTS, default: 'priority' })
  @IsOptional()
  @IsIn(PUBLIC_PACK_SORTS)
  sort?: PublicPackSort;

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
