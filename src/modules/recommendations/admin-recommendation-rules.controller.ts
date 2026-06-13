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
  RecommendationResponse,
  RecommendationRuleResponse,
} from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { CreateRecommendationRuleDto } from './dto/create-recommendation-rule.dto';
import { QueryRecommendationRulesDto } from './dto/query-recommendation-rules.dto';
import { UpdateRecommendationRuleDto } from './dto/update-recommendation-rule.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Admin Recommendation Rules')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/recommendation-rules')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminRecommendationRulesController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List recommendation rules',
    description:
      'OWNER, ADMIN, and STAFF can read paginated recommendation scoring rules.',
  })
  @ApiOkResponse({
    description: 'Paginated recommendation rules.',
    type: RecommendationRuleResponse,
  })
  findAll(@Query() query: QueryRecommendationRulesDto) {
    return this.recommendationsService.adminFindRules(query);
  }

  @Post('preview')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Preview recommendations without persistence',
    description:
      'OWNER, ADMIN, and STAFF can preview current rule effects. This endpoint does not create recommendation sessions, results, or items.',
  })
  @ApiOkResponse({
    description: 'Preview recommendations without persisting a session.',
    type: RecommendationResponse,
  })
  preview(@Body() dto: CreateRecommendationDto) {
    return this.recommendationsService.preview(dto);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get recommendation rule details',
    description:
      'OWNER, ADMIN, and STAFF can read recommendation rule details.',
  })
  @ApiOkResponse({
    description: 'Recommendation rule details.',
    type: RecommendationRuleResponse,
  })
  @ApiNotFoundResponse({ description: 'Recommendation rule not found.' })
  findOne(@Param('id') id: string) {
    return this.recommendationsService.adminFindRule(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create recommendation rule',
    description:
      'OWNER and ADMIN can create scoring rules. Rule codes are immutable after creation.',
  })
  @ApiOkResponse({ description: 'Recommendation rule created.' })
  @ApiConflictResponse({
    description: 'Recommendation rule code already exists.',
  })
  create(@Body() dto: CreateRecommendationRuleDto) {
    return this.recommendationsService.adminCreateRule(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update recommendation rule',
    description:
      'OWNER and ADMIN can update mutable recommendation rule fields.',
  })
  @ApiOkResponse({ description: 'Recommendation rule updated.' })
  @ApiNotFoundResponse({ description: 'Recommendation rule not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateRecommendationRuleDto) {
    return this.recommendationsService.adminUpdateRule(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate recommendation rule',
    description: 'OWNER and ADMIN can soft-deactivate recommendation rules.',
  })
  @ApiOkResponse({ description: 'Recommendation rule deactivated.' })
  @ApiNotFoundResponse({ description: 'Recommendation rule not found.' })
  deactivate(@Param('id') id: string) {
    return this.recommendationsService.adminDeactivateRule(id);
  }
}
