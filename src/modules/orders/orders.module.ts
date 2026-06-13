import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderWorkflowService } from './order-workflow.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderWorkflowService],
})
export class OrdersModule {}
