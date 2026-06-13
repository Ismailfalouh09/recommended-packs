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
import {
  AttributeGroupResponse,
  AttributeOptionResponse,
} from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttributesService } from './attributes.service';
import { CreateAttributeGroupDto } from './dto/create-attribute-group.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { QueryAttributeGroupsDto } from './dto/query-attribute-groups.dto';
import { QueryAttributeOptionsDto } from './dto/query-attribute-options.dto';
import { UpdateAttributeGroupDto } from './dto/update-attribute-group.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';

@ApiTags('Admin Attributes')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminAttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get('admin/attributes')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin attribute groups',
    description: 'OWNER, ADMIN, and STAFF can read paginated attribute groups.',
  })
  @ApiOkResponse({
    description: 'Paginated attribute groups.',
    type: AttributeGroupResponse,
  })
  findGroups(@Query() query: QueryAttributeGroupsDto) {
    return this.attributesService.adminFindGroups(query);
  }

  @Get('admin/attributes/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin attribute group details',
    description: 'OWNER, ADMIN, and STAFF can read attribute group details.',
  })
  @ApiOkResponse({
    description: 'Attribute group details.',
    type: AttributeGroupResponse,
  })
  @ApiNotFoundResponse({ description: 'Attribute group not found.' })
  findGroup(@Param('id') id: string) {
    return this.attributesService.adminFindGroup(id);
  }

  @Post('admin/attributes')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create attribute group',
    description:
      'OWNER and ADMIN can create attribute groups. Group codes are immutable after creation.',
  })
  @ApiOkResponse({ description: 'Attribute group created.' })
  @ApiConflictResponse({ description: 'Attribute group code already exists.' })
  createGroup(@Body() dto: CreateAttributeGroupDto) {
    return this.attributesService.adminCreateGroup(dto);
  }

  @Patch('admin/attributes/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update attribute group',
    description: 'OWNER and ADMIN can update mutable attribute group fields.',
  })
  @ApiOkResponse({ description: 'Attribute group updated.' })
  @ApiNotFoundResponse({ description: 'Attribute group not found.' })
  updateGroup(@Param('id') id: string, @Body() dto: UpdateAttributeGroupDto) {
    return this.attributesService.adminUpdateGroup(id, dto);
  }

  @Delete('admin/attributes/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate attribute group',
    description: 'OWNER and ADMIN can soft-deactivate attribute groups.',
  })
  @ApiOkResponse({ description: 'Attribute group deactivated.' })
  @ApiNotFoundResponse({ description: 'Attribute group not found.' })
  deactivateGroup(@Param('id') id: string) {
    return this.attributesService.adminDeactivateGroup(id);
  }

  @Get('admin/attributes/:attributeGroupId/options')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin attribute options',
    description:
      'OWNER, ADMIN, and STAFF can read options for one attribute group.',
  })
  @ApiOkResponse({
    description: 'Paginated attribute options.',
    type: AttributeOptionResponse,
  })
  @ApiNotFoundResponse({ description: 'Attribute group not found.' })
  findOptions(
    @Param('attributeGroupId') attributeGroupId: string,
    @Query() query: QueryAttributeOptionsDto,
  ) {
    return this.attributesService.adminFindOptions(attributeGroupId, query);
  }

  @Get('admin/attribute-options/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin attribute option details',
    description: 'OWNER, ADMIN, and STAFF can read attribute option details.',
  })
  @ApiOkResponse({
    description: 'Attribute option details.',
    type: AttributeOptionResponse,
  })
  @ApiNotFoundResponse({ description: 'Attribute option not found.' })
  findOption(@Param('id') id: string) {
    return this.attributesService.adminFindOption(id);
  }

  @Post('admin/attributes/:attributeGroupId/options')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create attribute option',
    description:
      'OWNER and ADMIN can create options under an attribute group. Option codes are immutable after creation.',
  })
  @ApiOkResponse({ description: 'Attribute option created.' })
  @ApiConflictResponse({ description: 'Attribute option code already exists.' })
  createOption(
    @Param('attributeGroupId') attributeGroupId: string,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return this.attributesService.adminCreateOption(attributeGroupId, dto);
  }

  @Patch('admin/attribute-options/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update attribute option',
    description: 'OWNER and ADMIN can update mutable attribute option fields.',
  })
  @ApiOkResponse({ description: 'Attribute option updated.' })
  @ApiNotFoundResponse({ description: 'Attribute option not found.' })
  updateOption(@Param('id') id: string, @Body() dto: UpdateAttributeOptionDto) {
    return this.attributesService.adminUpdateOption(id, dto);
  }

  @Delete('admin/attribute-options/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate attribute option',
    description: 'OWNER and ADMIN can soft-deactivate attribute options.',
  })
  @ApiOkResponse({ description: 'Attribute option deactivated.' })
  @ApiNotFoundResponse({ description: 'Attribute option not found.' })
  deactivateOption(@Param('id') id: string) {
    return this.attributesService.adminDeactivateOption(id);
  }
}
