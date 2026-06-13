import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PackResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePackDto } from './dto/create-pack.dto';
import { QueryPacksDto } from './dto/query-packs.dto';
import { UpdatePackDto } from './dto/update-pack.dto';
import { PacksService } from './packs.service';

@ApiTags('Admin Packs')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/packs')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminPacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin packs',
    description:
      'OWNER, ADMIN, and STAFF can read paginated packs with admin metadata.',
  })
  @ApiOkResponse({ description: 'Paginated packs.', type: PackResponse })
  findAll(@Query() query: QueryPacksDto) {
    return this.packsService.adminFindAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin pack details',
    description: 'OWNER, ADMIN, and STAFF can read full pack details.',
  })
  @ApiOkResponse({ description: 'Pack details.', type: PackResponse })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  findOne(@Param('id') id: string) {
    return this.packsService.adminFindOne(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create pack',
    description:
      'OWNER and ADMIN can create draft or active packs. Active packs must pass item, pricing, and attribute validation.',
  })
  @ApiOkResponse({ description: 'Pack created.' })
  @ApiConflictResponse({ description: 'Pack slug already exists.' })
  create(@Body() dto: CreatePackDto) {
    return this.packsService.adminCreate(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update pack',
    description:
      'OWNER and ADMIN can update packs. Nested items and attributes are replaced transactionally when provided.',
  })
  @ApiOkResponse({ description: 'Pack updated.' })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  @ApiConflictResponse({ description: 'Pack slug already exists.' })
  update(@Param('id') id: string, @Body() dto: UpdatePackDto) {
    return this.packsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Archive pack',
    description:
      'OWNER and ADMIN can archive a pack without deleting historical relations.',
  })
  @ApiOkResponse({ description: 'Pack archived.' })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  archive(@Param('id') id: string) {
    return this.packsService.adminArchive(id);
  }
}
