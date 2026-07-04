import { ApiPropertyOptional } from '@nestjs/swagger';
import { MediaRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

export class UploadMediaDto {
  @ApiPropertyOptional({
    description: 'Image role for products and packs. Defaults to GALLERY.',
    enum: [MediaRole.COVER, MediaRole.GALLERY],
    example: MediaRole.GALLERY,
  })
  @IsOptional()
  @IsEnum(MediaRole)
  role?: MediaRole;

  @ApiPropertyOptional({
    description: 'Alternative text or internal image description.',
    example: 'Soft glam foundation product image',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description:
      'Non-negative display position. Defaults to the next position.',
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

export class UploadSingleImageDto {
  @ApiPropertyOptional({
    description: 'Alternative text or internal image description.',
    example: 'Medium warm shade swatch',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;
}
