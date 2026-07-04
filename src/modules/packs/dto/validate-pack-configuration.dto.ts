import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Pack Core Evolution (Phase 5) — proposed configuration for one base Pack item.
 *
 * The client identifies the slot by `packItemId` only. It may propose a chosen
 * reference (for required-selectable slots or allowed replacements), a new
 * quantity, and/or removal of an optional item. No price is ever accepted from
 * the client — pricing is recalculated server-side from the current allowed
 * references.
 */
export class ValidateConfigurationItemDto {
  @ApiProperty({
    description: 'The PackItem (slot) this selection applies to.',
    example: '00000000-0000-4000-8000-000000000010',
  })
  @IsUUID()
  packItemId!: string;

  @ApiPropertyOptional({
    description:
      'Chosen product reference for a required-selectable slot or an allowed ' +
      'replacement. Must belong to the slot’s PackItemAllowedReference set.',
    example: '00000000-0000-4000-8000-000000000020',
  })
  @IsOptional()
  @IsUUID()
  productReferenceId?: string;

  @ApiPropertyOptional({
    description:
      'Proposed quantity for this slot. Only honored when the slot is ' +
      'quantityEditable and the value is within its min/max quantity.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description:
      'Request removal of this slot. Only allowed for optional-included items ' +
      'whose removalAllowed flag is true.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  removed?: boolean;
}

/**
 * Pack Core Evolution (Phase 5) — proposed add-on to append to the Pack.
 *
 * Add-ons must exist in the Pack’s PackAllowedAddOn set (matched by product and,
 * when the allow-list pins one, by reference).
 */
export class ValidateConfigurationAddOnDto {
  @ApiProperty({
    description: 'Add-on product. Must exist in the Pack’s PackAllowedAddOn set.',
    example: '00000000-0000-4000-8000-000000000030',
  })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({
    description:
      'Chosen reference for the add-on. Required when the allow-list does not ' +
      'pin one; must match the pinned reference when it does.',
    example: '00000000-0000-4000-8000-000000000031',
  })
  @IsOptional()
  @IsUUID()
  productReferenceId?: string;

  @ApiPropertyOptional({
    description: 'Add-on quantity (defaults to 1).',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

/**
 * Pack Core Evolution (Phase 5) — request body for
 * `POST /packs/:packId/validate-configuration`.
 *
 * Read-only, server-authoritative validation of a proposed customizable-Pack
 * composition. Nothing is persisted. The Pack is identified by the `:packId`
 * route parameter; the body only carries the customer’s proposed selections,
 * never prices or item snapshots.
 */
export class ValidatePackConfigurationDto {
  @ApiPropertyOptional({
    type: [ValidateConfigurationItemDto],
    description: 'Per-slot selections/removals/quantity changes.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateConfigurationItemDto)
  items?: ValidateConfigurationItemDto[];

  @ApiPropertyOptional({
    type: [ValidateConfigurationAddOnDto],
    description: 'Add-ons to append, each validated against PackAllowedAddOn.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateConfigurationAddOnDto)
  addOns?: ValidateConfigurationAddOnDto[];
}
