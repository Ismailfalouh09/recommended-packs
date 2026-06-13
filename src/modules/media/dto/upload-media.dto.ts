import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

export class UploadMediaDto {
  @ApiPropertyOptional({
    description:
      'Cloudinary folder override. Defaults to CLOUDINARY_UPLOAD_FOLDER or recommended-packs/dev.',
    example: 'recommended-packs/products',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(180)
  @Matches(/^[A-Za-z0-9/_-]+$/)
  folder?: string;

  @ApiPropertyOptional({
    description: 'Accessible alt text or internal image description.',
    example: 'Foundation bottle shade medium warm',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description: 'Optional usage context for future attachment workflows.',
    example: 'PRODUCT_MAIN_IMAGE',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(120)
  usageContext?: string;

  @ApiPropertyOptional({
    description: 'Optional entity type this asset is intended for.',
    example: 'PRODUCT',
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(80)
  relatedEntity?: string;

  @ApiPropertyOptional({
    description: 'Optional entity ID this asset is intended for.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;
}
