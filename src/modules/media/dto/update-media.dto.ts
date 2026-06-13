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

export class UpdateMediaDto {
  @ApiPropertyOptional({
    description: 'Product or pack image role.',
    enum: [MediaRole.COVER, MediaRole.GALLERY],
    example: MediaRole.COVER,
  })
  @IsOptional()
  @IsEnum(MediaRole)
  role?: MediaRole;

  @ApiPropertyOptional({
    description: 'Alternative text or internal image description.',
    example: 'Updated foundation image description',
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
