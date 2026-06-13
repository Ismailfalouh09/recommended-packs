import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminOrderDetailsResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { CurrentAdminUser } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderWorkflowService } from './order-workflow.service';
import { OrdersService } from './orders.service';

@ApiTags('Admin Orders')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin orders',
    description:
      'OWNER, ADMIN, and STAFF can search, filter, sort, and paginate orders.',
  })
  @ApiOkResponse({
    description: 'Paginated orders.',
    type: AdminOrderDetailsResponse,
  })
  findAll(@Query() query: QueryAdminOrdersDto) {
    return this.ordersService.adminFindAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin order details',
    description:
      'OWNER, ADMIN, and STAFF can view full order details, customer/address data, selected pack, items, recommendation summary, and status history.',
  })
  @ApiOkResponse({
    description: 'Complete order details.',
    type: AdminOrderDetailsResponse,
  })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  findOne(@Param('id') id: string) {
    return this.ordersService.adminFindOne(id);
  }

  @Patch(':id/status')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update order status',
    description:
      'OWNER and ADMIN can move an order through the enforced workflow. COD orders are marked PAID on DELIVERED and REFUNDED on RETURNED after payment.',
  })
  @ApiOkResponse({
    description: 'Order status updated.',
    type: AdminOrderDetailsResponse,
  })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.orderWorkflowService.updateStatus(id, dto, currentAdmin);
  }
}
