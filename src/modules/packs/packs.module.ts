import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminPacksController } from './admin-packs.controller';
import { PackConfigurationsController } from './pack-configurations.controller';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { SharedConfigurationsController } from './shared-configurations.controller';

@Module({
  imports: [PrismaModule, MediaModule, OrdersModule],
  controllers: [
    PacksController,
    PackConfigurationsController,
    SharedConfigurationsController,
    AdminPacksController,
  ],
  providers: [PacksService],
})
export class PacksModule {}
