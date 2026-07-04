import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';
import {
  optionalTrimmedString,
  optionalUpperSnake,
} from '../../../common/transforms/query.transforms';

export class CreateAttributeOptionDto {
  @ApiProperty({ example: 'FULL' })
  @Transform(({ value }) => optionalUpperSnake(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @ApiProperty({ example: 'Full Coverage' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  label!: string;

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

  @ApiPropertyOptional({ example: 3, default: 0 })
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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
