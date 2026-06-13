import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAttributesController } from './admin-attributes.controller';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttributesController, AdminAttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
