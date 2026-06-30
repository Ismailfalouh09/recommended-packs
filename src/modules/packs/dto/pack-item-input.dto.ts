import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackItemRole, SelectionMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class PackItemInputDto {
  @ApiProperty({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  productReferenceId?: string | null;

  @ApiProperty({
    enum: SelectionMode,
    example: SelectionMode.AUTO_BEST_REFERENCE,
  })
  @IsEnum(SelectionMode)
  selectionMode!: SelectionMode;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  /**
   * Pack Core Evolution (Phase 2) — additive role taxonomy & customization
   * rules. Foundation-only: persisted and returned, but inert in current
   * runtime logic (`selectionMode`/`isRequired` remain authoritative).
   */
  @ApiPropertyOptional({
    enum: PackItemRole,
    default: PackItemRole.FIXED,
    description:
      'Foundation-only role taxonomy. Defaults to FIXED. Not authoritative in Phase 2.',
  })
  @IsOptional()
  @IsEnum(PackItemRole)
  role?: PackItemRole;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxQuantity?: number | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  quantityEditable?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  removalAllowed?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  replacementAllowed?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Foundation-only set of allowed ProductReference IDs (must belong to this item product). Inert in Phase 2.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allowedReferenceIds?: string[];
}
