import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminBrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
