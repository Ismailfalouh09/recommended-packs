import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminPacksController } from './admin-packs.controller';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';

@Module({
  imports: [PrismaModule],
  controllers: [PacksController, AdminPacksController],
  providers: [PacksService],
})
export class PacksModule {}
