import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SharedPackConfigurationResponse } from '../../common/swagger/api-response.models';
import { PacksService } from './packs.service';

/**
 * Pack Core Evolution (Phase 8B) — public, read-only view of a shared pack
 * configuration, resolved by its opaque share token. Kept on its own
 * `shared/configurations` base path (distinct from the id-addressed
 * `configurations` routes). The response uses a dedicated customer-safe mapper:
 * it never exposes customer, quiz, validation, price-floor, stock, or cost data.
 */
@ApiTags('Packs')
@Controller('shared/configurations')
export class SharedConfigurationsController {
  constructor(private readonly packsService: PacksService) {}

  @Get(':shareToken')
  @ApiOperation({
    summary: 'Get a shared pack configuration by its share token',
    description:
      'Returns the read-only, customer-safe view of a shared pack configuration: ' +
      'the source Pack name/image, the selected products/references, quantities, ' +
      'add-ons, and the final displayed price + currency. No customer, quiz, ' +
      'validation, price-floor, stock, or cost data is ever included.',
  })
  @ApiParam({
    name: 'shareToken',
    description: 'Opaque share token minted by POST /configurations/:id/share.',
  })
  @ApiOkResponse({
    description: 'The customer-safe shared configuration view.',
    type: SharedPackConfigurationResponse,
  })
  @ApiNotFoundResponse({ description: 'Shared configuration not found.' })
  findShared(@Param('shareToken') shareToken: string) {
    return this.packsService.findSharedConfiguration(shareToken);
  }
}
