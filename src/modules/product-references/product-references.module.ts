import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AdminProductReferencesController } from './admin-product-references.controller';
import { ProductReferencesService } from './product-references.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [AdminProductReferencesController],
  providers: [ProductReferencesService],
})
export class ProductReferencesModule {}
