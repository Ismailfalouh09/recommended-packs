import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/swagger/api-response.models';
import { QueryPublicReviewsDto } from './dto/query-public-reviews.dto';
import { ReviewsService } from './reviews.service';

/**
 * Reviews & Ratings (Phase R2) — public approved-review reads.
 *
 * Returns APPROVED reviews only, plus a safe rating summary (`ratingAverage`,
 * `reviewCount`) computed from APPROVED reviews on read. Only public review
 * fields are exposed (rating, title, comment, masked author display name,
 * verified flag, createdAt); no customer/order private data is ever returned.
 */
@ApiTags('Reviews')
@Controller()
export class PublicReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:slug/reviews')
  @ApiOperation({
    summary: 'List approved reviews for a product',
    description:
      'Returns APPROVED reviews only for an active product, with a safe rating ' +
      'summary (ratingAverage, reviewCount) and pagination.',
  })
  @ApiParam({ name: 'slug', description: 'Product slug.', example: 'foundation-x' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Approved product reviews with a rating summary.' })
  @ApiNotFoundResponse({ description: 'Product not found.', type: ApiErrorResponse })
  productReviews(
    @Param('slug') slug: string,
    @Query() query: QueryPublicReviewsDto,
  ) {
    return this.reviewsService.listProductReviews(slug, query);
  }

  @Get('packs/:slug/reviews')
  @ApiOperation({
    summary: 'List approved reviews for a pack',
    description:
      'Returns APPROVED reviews only for an active, public pack, with a safe ' +
      'rating summary (ratingAverage, reviewCount) and pagination.',
  })
  @ApiParam({ name: 'slug', description: 'Pack slug.', example: 'bridal-glam' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Approved pack reviews with a rating summary.' })
  @ApiNotFoundResponse({ description: 'Pack not found.', type: ApiErrorResponse })
  packReviews(@Param('slug') slug: string, @Query() query: QueryPublicReviewsDto) {
    return this.reviewsService.listPackReviews(slug, query);
  }
}
