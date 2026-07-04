import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Reviews & Ratings (Phase R3) - admin approve/reject request.
 */
export class ModerateReviewDto {
  @ApiProperty({
    enum: [ReviewStatus.APPROVED, ReviewStatus.REJECTED],
    example: ReviewStatus.APPROVED,
  })
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  status!: ReviewStatus;

  @ApiPropertyOptional({
    example: 'Admin-only reason',
    description: 'Internal note for rejected reviews. Never returned publicly.',
  })
  @ValidateIf((dto: ModerateReviewDto) => dto.status === ReviewStatus.REJECTED)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  moderationNote?: string;
}
