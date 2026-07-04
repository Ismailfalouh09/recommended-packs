import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  PublicProductCardResponse,
  PublicProductDetailResponse,
} from '../../common/swagger/api-response.models';
import { QueryPublicProductDetailDto } from './dto/query-public-product-detail.dto';
import { QueryPublicProductsDto } from './dto/query-public-products.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List active products',
    description:
      'Returns active products with optional public search, filters, sorting, and pagination.',
  })
  @ApiQuery({ name: 'search', required: false, example: 'foundation' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiQuery({ name: 'categoryCode', required: false, example: 'FOUNDATION' })
  @ApiQuery({
    name: 'brandId',
    required: false,
    example: '00000000-0000-4000-8000-000000000002',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'name', 'basePrice'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean })
  @ApiQuery({ name: 'onSale', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiOkResponse({
    description: 'Active product cards.',
    type: [PublicProductCardResponse],
  })
  findAll(@Query() query: QueryPublicProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get an active product by slug',
    description:
      'Returns the same public product detail response shape as GET /products/:id.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Product slug.',
    example: 'foundation-x',
  })
  @ApiOkResponse({
    description: 'Aggregated public product detail.',
    type: PublicProductDetailResponse,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiQuery({
    name: 'selectedReferenceId',
    required: false,
    description: 'Preferred active reference for the selected variant.',
  })
  findBySlug(
    @Param('slug') slug: string,
    @Query() query: QueryPublicProductDetailDto,
  ) {
    return this.productsService.findBySlug(slug, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an active product by ID',
    description:
      'Returns one active product with category, brand, references, and compatibility attributes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Aggregated public product detail.',
    type: PublicProductDetailResponse,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiQuery({
    name: 'selectedReferenceId',
    required: false,
    description: 'Preferred active reference for the selected variant.',
  })
  findOne(
    @Param('id') id: string,
    @Query() query: QueryPublicProductDetailDto,
  ) {
    return this.productsService.findOne(id, query);
  }
}
