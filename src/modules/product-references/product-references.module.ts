import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminProductReferencesController } from './admin-product-references.controller';
import { ProductReferencesService } from './product-references.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminProductReferencesController],
  providers: [ProductReferencesService],
})
export class ProductReferencesModule {}
