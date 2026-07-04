import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import {
  ValidateConfigurationAddOnDto,
  ValidateConfigurationItemDto,
} from './validate-pack-configuration.dto';

/**
 * Pack Core Evolution (Phase 9) — request body for
 * `POST /recommendations/:resultId/configure`.
 *
 * Turns a recommended Pack into a persisted `PackConfiguration`
 * (`sourceType = QUIZ_RECOMMENDED`). The Pack is resolved server-side from the
 * `:resultId` route parameter — never from the body. Fixed and auto-selected
 * items are prefilled from the recommended Pack; the body only carries the
 * customer's selections for the pack's `REQUIRED_SELECTABLE` (customer-choice)
 * slots (and optional allowed add-ons).
 *
 * Server-authoritative: no price, quantity default, stock, or reference is ever
 * trusted from the client. Slots left without a valid selection remain pending
 * and block checkout until the customer chooses an allowed option.
 */
export class ConfigureFromRecommendationDto {
  @ApiPropertyOptional({
    type: [ValidateConfigurationItemDto],
    description:
      'Customer selections for the recommended pack’s required-selectable ' +
      '(customer-choice) slots. Each is validated against the slot’s allowed ' +
      'references. Slots omitted here stay pending and block checkout.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateConfigurationItemDto)
  selections?: ValidateConfigurationItemDto[];

  @ApiPropertyOptional({
    type: [ValidateConfigurationAddOnDto],
    description: 'Optional add-ons, each validated against PackAllowedAddOn.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateConfigurationAddOnDto)
  addOns?: ValidateConfigurationAddOnDto[];
}
