import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PackResponse } from '../../common/swagger/api-response.models';
import { PacksService } from './packs.service';

@ApiTags('Packs')
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get()
  @ApiOperation({
    summary: 'List active packs',
    description:
      'Returns active packs with attributes, pack items, products, and fixed product references where configured.',
  })
  @ApiOkResponse({ description: 'Active packs.', type: [PackResponse] })
  findAll() {
    return this.packsService.findAll();
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
