import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProductResponse } from '../../common/swagger/api-response.models';
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiOkResponse({ description: 'Active products.', type: [ProductResponse] })
  findAll(@Query() query: QueryPublicProductsDto) {
    return this.productsService.findAll(query);
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
  @ApiOkResponse({ description: 'Product details.', type: ProductResponse })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
