import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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
  OrderCreateResponse,
  PackConfigurationResponse,
  PackConfigurationValidationResponse,
  PackResponse,
} from '../../common/swagger/api-response.models';
import { CreatePackOrderDto } from '../orders/dto/create-pack-order.dto';
import { OrdersService } from '../orders/orders.service';
import { QueryPublicPacksDto } from './dto/query-public-packs.dto';
import { ValidatePackConfigurationDto } from './dto/validate-pack-configuration.dto';
import { PacksService } from './packs.service';

@ApiTags('Packs')
@Controller('packs')
export class PacksController {
  constructor(
    private readonly packsService: PacksService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active packs (public catalog discovery)',
    description:
      'Returns active packs with attributes, pack items, products, and fixed product references where configured. ' +
      'Supports optional discovery filters (category, tier, occasion, experienceLevel, customizable, availableNow, ' +
      'featured, tags, search), sorting, and pagination. ' +
      'Backward compatible: with NO query parameters it returns the legacy plain array of active packs. ' +
      'When any filter/pagination parameter is supplied it returns a paginated envelope ({ data, pagination }) ' +
      'whose items additionally carry an `availableNow` flag.',
  })
  @ApiOkResponse({ description: 'Active packs.', type: [PackResponse] })
  findAll(@Query() query: QueryPublicPacksDto) {
    return this.packsService.findAllPublic(query);
  }

  @Post(':packId/order')
  @ApiOperation({
    summary: 'Place a Cash on Delivery order for a fixed pack',
    description:
      'Buys a single fixed, non-customizable pack as one unit. The server ' +
      'validates that the pack is active, available, and non-customizable with ' +
      'no required-selectable/customer-choice items, expands its fixed items ' +
      'into priced order lines (each carrying packId), applies the pack price ' +
      'mode (FIXED / SUM_ITEMS / SUM_ITEMS_WITH_DISCOUNT), and reserves stock ' +
      'atomically. No client-supplied item or price is accepted. This route is ' +
      'additive and does not affect POST /orders or POST /orders/checkout.',
  })
  @ApiParam({
    name: 'packId',
    description: 'Pack ID to purchase.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiBody({
    type: CreatePackOrderDto,
    examples: {
      fixedPackOrder: {
        summary: 'Fixed pack direct purchase',
        value: {
          fullName: 'Test Customer',
          phone: '0600000000',
          whatsappPhone: '0600000000',
          city: 'Casablanca',
          addressLine: 'Maarif',
          extraInfo: 'Near the pharmacy',
          notes: 'Call before delivery',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Fixed pack order created.',
    type: OrderCreateResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Pack inactive/archived, customizable, requires customer selection, ' +
      'unavailable, or has no purchasable items.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  orderFixedPack(
    @Param('packId') packId: string,
    @Body() dto: CreatePackOrderDto,
  ) {
    return this.ordersService.createFromFixedPack(packId, dto);
  }

  @Post(':packId/validate-configuration')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate a proposed customizable pack configuration',
    description:
      'Server-authoritative, read-only validation of a proposed composition for ' +
      'a customizable pack. The server recomputes the price from the current ' +
      'allowed product references (never trusting client prices), enforces every ' +
      'customization rule (required items present, allowed selectable/replacement ' +
      'references, permitted removals, editable quantities within min/max, allowed ' +
      'add-ons, min/max item counts), validates live stock, and rejects a price ' +
      'below the pack price floor. Nothing is persisted and no stock is reserved. ' +
      'Only packs with isCustomizable=true are accepted. This route is additive ' +
      'and does not affect POST /orders, POST /orders/checkout, or POST /packs/:id/order.',
  })
  @ApiParam({
    name: 'packId',
    description: 'Customizable pack ID to validate a configuration for.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiBody({
    type: ValidatePackConfigurationDto,
    examples: {
      selectRequiredShade: {
        summary: 'Choose a required-selectable shade and add an add-on',
        value: {
          items: [
            {
              packItemId: '00000000-0000-4000-8000-000000000010',
              productReferenceId: '00000000-0000-4000-8000-000000000020',
            },
          ],
          addOns: [
            {
              productId: '00000000-0000-4000-8000-000000000030',
              productReferenceId: '00000000-0000-4000-8000-000000000031',
              quantity: 1,
            },
          ],
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Validation result: validity, server-computed price, floor, stock status, ' +
      'normalized items, and any validation errors.',
    type: PackConfigurationValidationResponse,
  })
  @ApiBadRequestResponse({
    description: 'Pack inactive/archived or not customizable.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  validateConfiguration(
    @Param('packId') packId: string,
    @Body() dto: ValidatePackConfigurationDto,
  ) {
    return this.packsService.validateConfiguration(packId, dto);
  }

  @Post(':packId/configurations')
  @ApiOperation({
    summary: 'Persist a validated customizable pack configuration',
    description:
      'Server-authoritative persistence of a proposed customizable pack ' +
      'configuration. The server re-runs the Phase 5 validator (recomputing the ' +
      'price from current allowed references, never trusting client prices) and ' +
      'persists ONLY when the configuration is valid. An invalid configuration is ' +
      'rejected with 400 and its validationErrors, and nothing is saved. The ' +
      'stored configuration captures the normalized composition (selected ' +
      'references, quantities, removed optional items, added add-ons), the ' +
      'recomputed final price, currency, price floor, and the immutable ' +
      'validation result. Additive: does not affect POST /orders, ' +
      'POST /orders/checkout, or POST /packs/:id/order.',
  })
  @ApiParam({
    name: 'packId',
    description: 'Customizable pack ID to configure.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiBody({ type: ValidatePackConfigurationDto })
  @ApiCreatedResponse({
    description: 'Persisted, server-validated pack configuration.',
    type: PackConfigurationResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Pack inactive/archived, not customizable, or the proposed configuration ' +
      'is invalid (not persisted).',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  createConfiguration(
    @Param('packId') packId: string,
    @Body() dto: ValidatePackConfigurationDto,
  ) {
    return this.packsService.createConfiguration(packId, dto);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get an active pack by slug',
    description:
      'Returns the same public pack detail response shape as GET /packs/:id.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Pack slug.',
    example: 'natural-glow-pack',
  })
  @ApiOkResponse({ description: 'Pack details.', type: PackResponse })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  findBySlug(@Param('slug') slug: string) {
    return this.packsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an active pack by ID',
    description:
      'Returns one active pack with attributes, items, products, fixed references, and useful product references.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pack ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({ description: 'Pack details.', type: PackResponse })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  findOne(@Param('id') id: string) {
    return this.packsService.findOne(id);
  }
}
