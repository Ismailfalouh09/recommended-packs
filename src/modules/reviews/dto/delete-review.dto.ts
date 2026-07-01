import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Reviews & Ratings (Phase R2) — proof for `DELETE /reviews/:reviewId`.
 *
 * With no login, the original `orderId` is the ownership proof required to
 * delete a still-PENDING review. Passed as a query parameter so the DELETE has
 * no request body.
 */
export class DeleteReviewDto {
  @ApiProperty({
    description: 'The original order the review was created from (ownership proof).',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  orderId!: string;
}
