import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorResponse,
  CartOrderCreateResponse,
  OrderCreateResponse,
  PublicOrderResponse,
} from '../../common/swagger/api-response.models';
import { CreateCartOrderDto } from './dto/create-cart-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Create a Cash on Delivery order from cart items',
    description:
      'Creates a normal-store Cash on Delivery order from direct cart lines. This route is separate from the quiz/recommendation funnel order endpoint.',
  })
  @ApiBody({
    type: CreateCartOrderDto,
    examples: {
      checkout: {
        summary: 'Normal store checkout',
        value: {
          items: [
            {
              productId: '00000000-0000-0000-0000-000000000001',
              referenceId: '00000000-0000-0000-0000-000000000002',
              quantity: 1,
            },
          ],
          fullName: 'Test Customer',
          phone: '0600000000',
          whatsappPhone: '0600000000',
          city: 'Casablanca',
          addressLine: 'Test address',
          extraInfo: 'Near main street',
          notes: 'Call before delivery',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Cart order created.',
    type: CartOrderCreateResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid cart payload, inactive product/reference, reference mismatch, or insufficient stock.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Product or reference not found.',
    type: ApiErrorResponse,
  })
  createFromCart(@Body() dto: CreateCartOrderDto) {
    return this.ordersService.createFromCart(dto);
  }

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
