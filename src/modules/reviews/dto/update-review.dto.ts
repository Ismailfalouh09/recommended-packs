import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

/**
 * Reviews & Ratings (Phase R2) — request body for `PATCH /reviews/:reviewId`.
 *
 * With no login, the original `orderId` is the proof of ownership required to
 * edit. Only the review's own content (`rating`, `title`, `comment`) may change;
 * the target, order, and customer are immutable. Editing is allowed only while
 * the review is PENDING and the edit keeps it PENDING for re-moderation.
 */
export class UpdateReviewDto {
  @ApiProperty({
    description:
      'The original order the review was created from. Acts as the ownership ' +
      'proof; it is never changed by the edit.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  orderId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value) ?? null)
  @IsString()
  @MaxLength(160)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value) ?? null)
  @IsString()
  @MaxLength(4000)
  comment?: string | null;
}
