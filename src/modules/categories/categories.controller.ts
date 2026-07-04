import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicCategoryResponse } from '../../common/swagger/api-response.models';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List active public categories',
    description:
      'Returns active store categories ordered for public navigation and category tiles.',
  })
  @ApiOkResponse({
    description: 'Active public categories.',
    type: [PublicCategoryResponse],
  })
  findAll() {
    return this.categoriesService.publicFindAll();
  }
}
