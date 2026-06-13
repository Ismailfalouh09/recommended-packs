import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  OrderCreateResponse,
  PublicOrderResponse,
} from '../../common/swagger/api-response.models';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a Cash on Delivery order',
    description:
      'Creates or reuses a customer, creates a default delivery address, creates order item snapshots from a selected recommendation result, and creates initial status history.',
  })
  @ApiCreatedResponse({
    description: 'Order created.',
    type: OrderCreateResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid recommendation result, inactive selected pack/product/reference, or out-of-stock selected reference.',
  })
  @ApiNotFoundResponse({ description: 'Recommendation result not found.' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get safe public order summary',
    description:
      'Returns a limited public order summary. It intentionally excludes phone, address, notes, items, and status history.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Safe public order summary.',
    type: PublicOrderResponse,
  })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
