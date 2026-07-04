import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

export class UpdateMediaAssetDto {
  @ApiPropertyOptional({
    description: 'Accessible alt text or internal image description.',
    example: 'Updated foundation shade image',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({
    description: 'Optional usage context for future attachment workflows.',
    example: 'PACK_MAIN_IMAGE',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(120)
  usageContext?: string;

  @ApiPropertyOptional({
    description: 'Optional entity type this asset is intended for.',
    example: 'PACK',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(80)
  relatedEntity?: string;

  @ApiPropertyOptional({
    description: 'Optional entity ID this asset is intended for.',
    example: '00000000-0000-4000-8000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;
}
