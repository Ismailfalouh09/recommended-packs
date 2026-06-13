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
import { ProductReferenceResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductReferenceDto } from './dto/create-product-reference.dto';
import { QueryProductReferencesDto } from './dto/query-product-references.dto';
import { UpdateProductReferenceDto } from './dto/update-product-reference.dto';
import { UpdateReferenceStockDto } from './dto/update-reference-stock.dto';
import { ProductReferencesService } from './product-references.service';

@ApiTags('Admin Product References')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminProductReferencesController {
  constructor(
    private readonly productReferencesService: ProductReferencesService,
  ) {}

  @Get('admin/products/:productId/references')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List product references for a product',
    description: 'OWNER, ADMIN, and STAFF can read references for one product.',
  })
  @ApiOkResponse({
    description: 'Paginated product references.',
    type: ProductReferenceResponse,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findAllForProduct(
    @Param('productId') productId: string,
    @Query() query: QueryProductReferencesDto,
  ) {
    return this.productReferencesService.findAllForProduct(productId, query);
  }

  @Get('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get product reference details',
    description: 'OWNER, ADMIN, and STAFF can read product reference details.',
  })
  @ApiOkResponse({
    description: 'Product reference details.',
    type: ProductReferenceResponse,
  })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  findOne(@Param('id') id: string) {
    return this.productReferencesService.findOne(id);
  }

  @Post('admin/products/:productId/references')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create product reference',
    description:
      'OWNER and ADMIN can create product references and compatibility attributes.',
  })
  @ApiOkResponse({ description: 'Product reference created.' })
  @ApiConflictResponse({
    description: 'Duplicate reference code, SKU, or barcode.',
  })
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateProductReferenceDto,
  ) {
    return this.productReferencesService.create(productId, dto);
  }

  @Patch('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product reference',
    description:
      'OWNER and ADMIN can update references and replace compatibility attributes.',
  })
  @ApiOkResponse({ description: 'Product reference updated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  @ApiConflictResponse({
    description: 'Duplicate reference code, SKU, or barcode.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateProductReferenceDto) {
    return this.productReferencesService.update(id, dto);
  }

  @Patch('admin/product-references/:id/stock')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product reference stock counts',
    description:
      'OWNER and ADMIN can update stock, reserved quantity, and low-stock threshold. This does not reserve or deduct stock automatically.',
  })
  @ApiOkResponse({ description: 'Product reference stock updated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  updateStock(@Param('id') id: string, @Body() dto: UpdateReferenceStockDto) {
    return this.productReferencesService.updateStock(id, dto);
  }

  @Delete('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate product reference',
    description: 'OWNER and ADMIN can soft-deactivate product references.',
  })
  @ApiOkResponse({ description: 'Product reference deactivated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  deactivate(@Param('id') id: string) {
    return this.productReferencesService.deactivate(id);
  }
}
