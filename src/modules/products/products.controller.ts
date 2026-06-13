import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProductResponse } from '../../common/swagger/api-response.models';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List active products',
    description:
      'Returns active products ordered by creation date with category, brand, references, and compatibility attributes.',
  })
  @ApiOkResponse({ description: 'Active products.', type: [ProductResponse] })
  findAll() {
    return this.productsService.findAll();
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
