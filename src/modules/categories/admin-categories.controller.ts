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
import { AdminCategoryResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Admin Categories')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/categories')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin categories',
    description: 'OWNER, ADMIN, and STAFF can read paginated categories.',
  })
  @ApiOkResponse({
    description: 'Paginated categories.',
    type: AdminCategoryResponse,
  })
  findAll(@Query() query: QueryCategoriesDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin category details',
    description: 'OWNER, ADMIN, and STAFF can read category details.',
  })
  @ApiOkResponse({
    description: 'Category details.',
    type: AdminCategoryResponse,
  })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create category',
    description: 'OWNER and ADMIN can create categories.',
  })
  @ApiOkResponse({ description: 'Category created.' })
  @ApiConflictResponse({ description: 'Category code already exists.' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update category',
    description: 'OWNER and ADMIN can update mutable category fields.',
  })
  @ApiOkResponse({ description: 'Category updated.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiConflictResponse({ description: 'Duplicate code or circular parent.' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate category',
    description: 'OWNER and ADMIN can soft-deactivate categories.',
  })
  @ApiOkResponse({ description: 'Category deactivated.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  deactivate(@Param('id') id: string) {
    return this.categoriesService.deactivate(id);
  }
}
