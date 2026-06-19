import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicBrandResponse } from '../../common/swagger/api-response.models';
import { BrandsService } from './brands.service';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({
    summary: 'List active public brands',
    description:
      'Returns active store brands for public brand filters, brand lists, and optional brand strips. Brand logo URLs are returned only from the existing brand logoUrl field.',
  })
  @ApiOkResponse({
    description: 'Active public brands.',
    type: [PublicBrandResponse],
  })
  findAll() {
    return this.brandsService.publicFindAll();
  }
}
