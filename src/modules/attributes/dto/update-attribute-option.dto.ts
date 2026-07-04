import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';

export class UpdateAttributeOptionDto {
  @ApiPropertyOptional({ example: 'Full Coverage' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'Maximum makeup coverage' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/full.jpg' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsUrl()
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    example: 150,
    nullable: true,
    description: 'Budget-only numeric lower bound.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minNumericValue?: number | null;

  @ApiPropertyOptional({
    example: 220,
    nullable: true,
    description: 'Budget-only numeric upper bound.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxNumericValue?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
