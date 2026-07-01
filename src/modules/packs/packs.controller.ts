import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  PackResponse,
} from '../../common/swagger/api-response.models';
import { CreatePackOrderDto } from '../orders/dto/create-pack-order.dto';
import { OrdersService } from '../orders/orders.service';
import { QueryPublicPacksDto } from './dto/query-public-packs.dto';
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
