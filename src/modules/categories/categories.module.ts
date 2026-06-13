import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [AdminCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
