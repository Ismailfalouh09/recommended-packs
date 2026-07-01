import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { PublicReviewsController } from './public-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Reviews & Ratings — customer review submission + public approved-review
 * reads (Phase R2) and customer-attached review images (Phase R2.5, reusing the
 * shared MediaModule pipeline). Admin moderation and rating-aggregate caching
 * are intentionally out of scope for these phases.
 */
@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [
    ReviewsController,
    PublicReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
