import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Reviews & Ratings (Phase R2.5) — body for `POST /reviews/:reviewId/images`.
 *
 * With no customer login, the original `orderId` is the ownership credential —
 * the same proof used to create/edit/delete the review. It travels as a
 * multipart form field alongside the uploaded image `file`.
 */
export class UploadReviewImageDto {
  @ApiProperty({
    description:
      'The original order the review was created from (ownership proof).',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  orderId!: string;
}
