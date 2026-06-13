import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AttributeGroupResponse,
  AttributeOptionResponse,
} from '../../common/swagger/api-response.models';
import { AttributesService } from './attributes.service';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @ApiOperation({
    summary: 'List active attribute groups',
    description:
      'Returns active customer attribute groups with active options ordered for the public quiz.',
  })
  @ApiOkResponse({
    description: 'Active attribute groups with options.',
    type: [AttributeGroupResponse],
  })
  findAll() {
    return this.attributesService.findAll();
  }

  @Get(':code/options')
  @ApiOperation({
    summary: 'List active options for an attribute group code',
    description: 'Returns active options for one active attribute group.',
  })
  @ApiParam({
    name: 'code',
    example: 'SKIN_COLOR',
    description: 'Attribute group code.',
  })
  @ApiOkResponse({
    description: 'Active attribute options.',
    type: [AttributeOptionResponse],
  })
  @ApiNotFoundResponse({ description: 'Attribute group not found.' })
  findOptionsByCode(@Param('code') code: string) {
    return this.attributesService.findOptionsByCode(code);
  }
}
