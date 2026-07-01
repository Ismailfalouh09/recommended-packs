import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorResponse,
  PackConfigurationResponse,
} from '../../common/swagger/api-response.models';
import { ConfigureFromRecommendationDto } from './dto/configure-from-recommendation.dto';
import { PacksService } from './packs.service';

/**
 * Pack Core Evolution (Phase 9) — turn a recommended Pack into a persisted
 * PackConfiguration (`sourceType = QUIZ_RECOMMENDED`). Lives on the
 * `recommendations` base path (the source of truth is the persisted
 * RecommendationResult), but reuses the same PacksService configuration machinery
 * and the same configured checkout as Phase 6. Additive: the existing
 * recommendation generation/read endpoints are untouched.
 */
@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationConfigurationsController {
  constructor(private readonly packsService: PacksService) {}

  @Post(':resultId/configure')
  @ApiOperation({
    summary: 'Configure a recommended pack into a checkout-ready configuration',
    description:
      'Creates a persisted PackConfiguration (sourceType QUIZ_RECOMMENDED) from ' +
      'an existing recommended Pack, resolved server-side from the recommendation ' +
      'result id. Fixed and auto-selected items are prefilled from the ' +
      'recommendation; the body only carries the customer’s selections for the ' +
      'pack’s required customer-choice slots (and optional allowed add-ons). The ' +
      'Phase 5 validator recomputes price and stock server-side — no client price ' +
      'is trusted. Required slots left without a valid selection are stored as ' +
      'pending (null reference) and keep blocking checkout until chosen; ' +
      'disallowed, inactive, out-of-stock, or below-floor selections are rejected ' +
      'and nothing is written. Quiz answers and recommendation scores are never ' +
      'copied into the configuration. The result can be checked out with the ' +
      'existing POST /configurations/:id/checkout.',
  })
  @ApiParam({
    name: 'resultId',
    description: 'Persisted recommendation result id (the recommended pack).',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiBody({ type: ConfigureFromRecommendationDto })
  @ApiCreatedResponse({
    description:
      'Persisted QUIZ_RECOMMENDED configuration. `pendingSelections` lists the ' +
      'pack item ids still awaiting a customer selection (empty when ready to ' +
      'check out).',
    type: PackConfigurationResponse,
  })
  @ApiBadRequestResponse({
    description:
      'A selection is disallowed, inactive, out of stock, below the price floor, ' +
      'or the recommended pack is inactive/archived.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Recommendation result or its pack not found.',
  })
  configure(
    @Param('resultId') resultId: string,
    @Body() dto: ConfigureFromRecommendationDto,
  ) {
    return this.packsService.configureFromRecommendation(resultId, dto);
  }
}
