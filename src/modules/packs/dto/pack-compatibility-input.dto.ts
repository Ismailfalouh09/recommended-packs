import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PackCompatibilityCriterion,
  PackCompatibilityMode,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { optionalUppercase } from '../../../common/transforms/query.transforms';

/**
 * Pack Core Evolution (Phase 2.5) — admin input for one compatibility criterion
 * of a Pack's compatibility profile.
 *
 * Semantics:
 * - `mode = RESTRICTED` (default): the Pack is suitable only for the listed
 *   canonical `optionCodes`. At least one code is required.
 * - `mode = UNIVERSAL`: the Pack does not depend on this criterion; no codes are
 *   allowed.
 * - Omitting a criterion entirely leaves it UNCONFIGURED.
 *
 * `optionCodes` must be canonical `AttributeOption` codes that belong to the
 * criterion's canonical group (e.g. SKIN_TONE -> SKIN_COLOR options). They are
 * never stored as free text — they resolve to existing AttributeOption records.
 */
export class PackCompatibilityInputDto {
  @ApiProperty({
    enum: PackCompatibilityCriterion,
    example: PackCompatibilityCriterion.SKIN_TONE,
  })
  @IsEnum(PackCompatibilityCriterion)
  criterion!: PackCompatibilityCriterion;

  @ApiPropertyOptional({
    enum: PackCompatibilityMode,
    default: PackCompatibilityMode.RESTRICTED,
    description:
      'RESTRICTED (default) requires >= 1 optionCodes. UNIVERSAL allows none.',
  })
  @IsOptional()
  @IsEnum(PackCompatibilityMode)
  mode?: PackCompatibilityMode;

  @ApiPropertyOptional({
    type: [String],
    example: ['LIGHT', 'MEDIUM'],
    description:
      'Canonical AttributeOption codes within the criterion group. Required when RESTRICTED; must be empty/omitted when UNIVERSAL.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((code) => optionalUppercase(code))
      : value,
  )
  @IsString({ each: true })
  optionCodes?: string[];
}
