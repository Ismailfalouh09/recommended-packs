import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewTargetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
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
 * Reviews & Ratings (Phase R2) — request body for `POST /reviews`.
 *
 * Because there is no customer login, the delivered order is the proof of
 * purchase. Ownership is derived server-side from that order — the client never
 * sends a `customerId`. The new review always starts PENDING and its author
 * display name is generated server-side; neither can be set from here.
 */
export class CreateReviewDto {
  @ApiProperty({
    description:
      'The delivered order that proves the purchase. Customer ownership is ' +
      'derived from this order server-side; no customerId is ever accepted.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ enum: ReviewTargetType })
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @ApiProperty({
    description: 'The reviewed Product id (PRODUCT) or Pack id (PACK).',
    example: '00000000-0000-4000-8000-000000000002',
  })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 160, example: 'Loved it' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: 'Great quality, would buy again.' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(4000)
  comment?: string;
}
