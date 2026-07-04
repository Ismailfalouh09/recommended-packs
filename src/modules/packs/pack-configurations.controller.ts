import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorResponse,
  ConfigurationShareResponse,
  OrderCreateResponse,
  PackConfigurationResponse,
} from '../../common/swagger/api-response.models';
import { CreatePackOrderDto } from '../orders/dto/create-pack-order.dto';
import { OrdersService } from '../orders/orders.service';
import { PacksService } from './packs.service';

/**
 * Pack Core Evolution (Phase 6) — read a persisted PackConfiguration and check
 * out from it. Kept on its own `configurations` base path (the configuration is
 * pack-independent once persisted). Configured checkout revalidates the stored
 * configuration server-side before creating a normal Cash-on-Delivery order.
 */
@ApiTags('Packs')
@Controller('configurations')
export class PackConfigurationsController {
  constructor(
    private readonly packsService: PacksService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get a persisted pack configuration',
    description:
      'Returns a previously persisted, server-validated pack configuration ' +
      'including its normalized composition, recomputed final price, currency, ' +
      'price floor, and frozen validation result.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pack configuration ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Persisted pack configuration.',
    type: PackConfigurationResponse,
  })
  @ApiNotFoundResponse({ description: 'Configuration not found.' })
  findOne(@Param('id') id: string) {
    return this.packsService.findConfiguration(id);
  }

  @Post(':id/share')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create (or return) a public share link for a pack configuration',
    description:
      'Mints an opaque, unique share token for a persisted configuration and ' +
      'returns a public share link that resolves the read-only, customer-safe ' +
      'shared view (GET /shared/configurations/:shareToken). Idempotent: a ' +
      'configuration keeps a single stable token, so re-sharing returns the same ' +
      'link. Possession of the configuration id is the capability (mirroring the ' +
      'already-public GET /configurations/:id) — a persisted configuration has no ' +
      'session owner in the data model. The shared view never exposes customer, ' +
      'quiz, validation, price-floor, stock, or cost data.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pack configuration ID to share.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'The share token and public share link.',
    type: ConfigurationShareResponse,
  })
  @ApiNotFoundResponse({ description: 'Configuration not found.' })
  share(@Param('id') id: string) {
    return this.packsService.shareConfiguration(id);
  }

  @Post(':id/checkout')
  @ApiOperation({
    summary: 'Place a Cash on Delivery order from a pack configuration',
    description:
      'Revalidates the persisted configuration against the current pack ' +
      '(stock, price, allowed composition, and minimum price) and, on success, ' +
      'creates a normal Cash-on-Delivery order: normal OrderItems carrying the ' +
      'source packId, atomic stock reservation, and an immutable ' +
      'packConfigurationSnapshot frozen on the order. Stale, unavailable, ' +
      'disallowed, or below-floor configurations are rejected and no order is ' +
      'created. Prices are always server-recomputed; no client price is trusted. ' +
      'Additive: does not affect POST /orders or POST /orders/checkout.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pack configuration ID to check out.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiBody({ type: CreatePackOrderDto })
  @ApiCreatedResponse({
    description: 'Configured pack order created.',
    type: OrderCreateResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Configuration is stale, unavailable, disallowed, below the price floor, ' +
      'or its source pack is inactive/non-customizable.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Configuration not found.' })
  checkout(@Param('id') id: string, @Body() dto: CreatePackOrderDto) {
    return this.ordersService.createFromConfiguration(id, dto);
  }
}
