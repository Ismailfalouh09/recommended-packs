import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PackResponse } from '../../common/swagger/api-response.models';
import { QueryPublicPacksDto } from './dto/query-public-packs.dto';
import { PacksService } from './packs.service';

@ApiTags('Packs')
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get()
  @ApiOperation({
    summary: 'List active packs (public catalog discovery)',
    description:
      'Returns active packs with attributes, pack items, products, and fixed product references where configured. ' +
      'Supports optional discovery filters (category, tier, occasion, experienceLevel, customizable, availableNow, ' +
      'featured, tags, search), sorting, and pagination. ' +
      'Backward compatible: with NO query parameters it returns the legacy plain array of active packs. ' +
      'When any filter/pagination parameter is supplied it returns a paginated envelope ({ data, pagination }) ' +
      'whose items additionally carry an `availableNow` flag.',
  })
  @ApiOkResponse({ description: 'Active packs.', type: [PackResponse] })
  findAll(@Query() query: QueryPublicPacksDto) {
    return this.packsService.findAllPublic(query);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get an active pack by slug',
    description:
      'Returns the same public pack detail response shape as GET /packs/:id.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Pack slug.',
    example: 'natural-glow-pack',
  })
  @ApiOkResponse({ description: 'Pack details.', type: PackResponse })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  findBySlug(@Param('slug') slug: string) {
    return this.packsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an active pack by ID',
    description:
      'Returns one active pack with attributes, items, products, fixed references, and useful product references.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pack ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({ description: 'Pack details.', type: PackResponse })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  findOne(@Param('id') id: string) {
    return this.packsService.findOne(id);
  }
}
