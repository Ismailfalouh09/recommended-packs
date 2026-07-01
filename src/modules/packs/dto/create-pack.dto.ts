import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PackExperienceLevel,
  PackOccasion,
  PackStatus,
  PackTier,
  PriceMode,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  optionalLowercase,
  optionalTrimmedString,
  optionalUppercase,
} from '../../../common/transforms/query.transforms';
import { PackAttributeInputDto } from './pack-attribute-input.dto';
import { PackCompatibilityInputDto } from './pack-compatibility-input.dto';
import { PackItemInputDto } from './pack-item-input.dto';

export class CreatePackDto {
  @ApiProperty({ example: 'Natural Glow Pack' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'natural-glow-pack' })
  @Transform(({ value }) => optionalLowercase(value))
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'Natural makeup pack' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/pack.jpg' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsUrl()
  mainImageUrl?: string | null;

  @ApiProperty({ enum: PriceMode, example: PriceMode.FIXED })
  @IsEnum(PriceMode)
  priceMode!: PriceMode;

  @ApiPropertyOptional({ example: 299 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedPrice?: number | null;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number | null;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number | null;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number | null;

  @ApiPropertyOptional({ example: 'MAD', default: 'MAD' })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ enum: PackStatus, default: PackStatus.DRAFT })
  @IsOptional()
  @IsEnum(PackStatus)
  status?: PackStatus;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Pack Core Evolution (Phase 2) — additive customization foundation fields.
   * Foundation-only: persisted and returned, but inert in current runtime
   * logic. Existing Packs default to a fixed (non-customizable) Pack.
   */
  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Foundation-only flag. Does NOT activate customization in Phase 2.',
  })
  @IsOptional()
  @IsBoolean()
  isCustomizable?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRequiredItems?: number | null;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxItemCount?: number | null;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAllowedPrice?: number | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Foundation-only set of allowed add-on Product IDs. Inert in Phase 2.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allowedAddOnIds?: string[];

  /**
   * Pack Core Evolution (Phase 4A) — additive public discovery fields. Optional
   * marketing/browsing classifications surfaced by the public catalog filters.
   * `categoryId` reuses the shared Category entity.
   */
  @ApiPropertyOptional({
    example: '00000000-0000-4000-8000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ enum: PackTier, nullable: true })
  @IsOptional()
  @IsEnum(PackTier)
  tier?: PackTier | null;

  @ApiPropertyOptional({ enum: PackOccasion, nullable: true })
  @IsOptional()
  @IsEnum(PackOccasion)
  occasion?: PackOccasion | null;

  @ApiPropertyOptional({ enum: PackExperienceLevel, nullable: true })
  @IsOptional()
  @IsEnum(PackExperienceLevel)
  experienceLevel?: PackExperienceLevel | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['bridal', 'glam'],
    description: 'Free-form discovery tags used by the public catalog filter.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'wedding bridal soft glam',
    nullable: true,
    description: 'Extra keywords matched by public free-text search.',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  searchKeywords?: string | null;

  @ApiPropertyOptional({ type: [PackItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackItemInputDto)
  items?: PackItemInputDto[];

  @ApiPropertyOptional({ type: [PackAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackAttributeInputDto)
  attributes?: PackAttributeInputDto[];

  /**
   * Pack Core Evolution (Phase 2.5) — Pack Compatibility Profile foundation.
   * Declares which canonical customer-answer values the Pack is suitable for,
   * across the five supported dimensions. Foundation-only: persisted and
   * returned, but NOT consumed by recommendation/scoring/pricing in this phase.
   * Omitting a criterion leaves it UNCONFIGURED.
   */
  @ApiPropertyOptional({
    type: [PackCompatibilityInputDto],
    description:
      'Per-criterion compatibility profile (skin tone, skin type, makeup style, budget, occasion). Foundation-only; not consumed by recommendation in this phase.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackCompatibilityInputDto)
  compatibility?: PackCompatibilityInputDto[];
}
