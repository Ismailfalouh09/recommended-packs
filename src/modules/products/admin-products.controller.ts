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
import { ProductResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Admin Products')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/products')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin products',
    description:
      'OWNER, ADMIN, and STAFF can read paginated products with admin-only stock/count summaries.',
  })
  @ApiOkResponse({ description: 'Paginated products.', type: ProductResponse })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.adminFindAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin product details',
    description: 'OWNER, ADMIN, and STAFF can read full product details.',
  })
  @ApiOkResponse({ description: 'Product details.', type: ProductResponse })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findOne(@Param('id') id: string) {
    return this.productsService.adminFindOne(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create product',
    description: 'OWNER and ADMIN can create catalog products.',
  })
  @ApiOkResponse({ description: 'Product created.' })
  @ApiConflictResponse({ description: 'Product slug already exists.' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.adminCreate(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product',
    description: 'OWNER and ADMIN can update mutable product fields.',
  })
  @ApiOkResponse({ description: 'Product updated.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Product slug already exists.' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Archive product',
    description:
      'OWNER and ADMIN can archive a product and deactivate its references.',
  })
  @ApiOkResponse({ description: 'Product archived.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  archive(@Param('id') id: string) {
    return this.productsService.adminArchive(id);
  }
}
