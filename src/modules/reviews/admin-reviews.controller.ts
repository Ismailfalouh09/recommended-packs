import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { ApiErrorResponse } from '../../common/swagger/api-response.models';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Admin Reviews')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/reviews')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List reviews for moderation',
    description:
      'OWNER, ADMIN, and STAFF can filter and paginate reviews for moderation. ' +
      'Customer phone/address, order internals, and storage keys are not returned.',
  })
  @ApiOkResponse({ description: 'Paginated admin review list.' })
  findAll(@Query() query: QueryAdminReviewsDto) {
    return this.reviewsService.adminFindAll(query);
  }

  @Patch(':reviewId/moderation')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Approve or reject a pending review',
    description:
      'OWNER and ADMIN can approve or reject a PENDING review. Attached images ' +
      'become public only when the parent review is APPROVED; rejected review ' +
      'images remain hidden with the review.',
  })
  @ApiOkResponse({ description: 'The moderated review.' })
  @ApiBadRequestResponse({
    description: 'Invalid moderation body.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Review not found.',
    type: ApiErrorResponse,
  })
  @ApiConflictResponse({
    description: 'Only PENDING reviews can be moderated.',
    type: ApiErrorResponse,
  })
  moderate(
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviewsService.adminModerate(reviewId, dto);
  }
}
