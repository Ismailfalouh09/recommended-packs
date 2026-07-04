import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

/**
 * Media Management (Task 14) — payload for adding one gallery image to a product
 * reference (shade). `role` is intentionally absent: gallery images have a fixed
 * GALLERY role, and primacy is managed through the dedicated set-primary
 * endpoint, not via free-form role edits.
 */
export class UploadReferenceGalleryImageDto {
  @ApiPropertyOptional({
    description: 'Alternative text describing the shade image.',
    example: 'Cherry Red lipstick swatch on lips',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description:
      'Non-negative display position. Defaults to the next position in the gallery.',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(0)
  position?: number;
}

/**
 * Media Management (Task 14) — payload for updating a reference gallery image's
 * alt text or display position. Primacy changes go through the set-primary
 * endpoint.
 */
export class UpdateReferenceGalleryImageDto {
  @ApiPropertyOptional({
    description: 'Alternative text describing the shade image.',
    example: 'Cherry Red lipstick swatch on the back of a hand',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description: 'Non-negative display position.',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
