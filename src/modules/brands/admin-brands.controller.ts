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
import { AdminBrandResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandsDto } from './dto/query-brands.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('Admin Brands')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/brands')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin brands',
    description: 'OWNER, ADMIN, and STAFF can read paginated brands.',
  })
  @ApiOkResponse({ description: 'Paginated brands.', type: AdminBrandResponse })
  findAll(@Query() query: QueryBrandsDto) {
    return this.brandsService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin brand details',
    description: 'OWNER, ADMIN, and STAFF can read brand details.',
  })
  @ApiOkResponse({ description: 'Brand details.', type: AdminBrandResponse })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create brand',
    description: 'OWNER and ADMIN can create brands.',
  })
  @ApiOkResponse({ description: 'Brand created.' })
  @ApiConflictResponse({ description: 'Brand name already exists.' })
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update brand',
    description: 'OWNER and ADMIN can update mutable brand fields.',
  })
  @ApiOkResponse({ description: 'Brand updated.' })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  @ApiConflictResponse({ description: 'Brand name already exists.' })
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate brand',
    description: 'OWNER and ADMIN can soft-deactivate brands.',
  })
  @ApiOkResponse({ description: 'Brand deactivated.' })
  @ApiNotFoundResponse({ description: 'Brand not found.' })
  deactivate(@Param('id') id: string) {
    return this.brandsService.deactivate(id);
  }
}
