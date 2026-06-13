import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
