import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackStatus, PriceMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  optionalLowercase,
  optionalTrimmedString,
  optionalUppercase,
} from '../../../common/transforms/query.transforms';
import { PackAttributeInputDto } from './pack-attribute-input.dto';
import { PackItemInputDto } from './pack-item-input.dto';

export class CreatePackDto {
  @ApiProperty({ example: 'Natural Glow Pack' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'natural-glow-pack' })
  @Transform(({ value }) => optionalLowercase(value))
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'Natural makeup pack' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/pack.jpg' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsUrl()
  mainImageUrl?: string | null;

  @ApiProperty({ enum: PriceMode, example: PriceMode.FIXED })
  @IsEnum(PriceMode)
  priceMode!: PriceMode;

  @ApiPropertyOptional({ example: 299 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedPrice?: number | null;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number | null;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number | null;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number | null;

  @ApiPropertyOptional({ example: 'MAD', default: 'MAD' })
  @IsOptional()
  @Transform(({ value }) => optionalUppercase(value))
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ enum: PackStatus, default: PackStatus.DRAFT })
  @IsOptional()
  @IsEnum(PackStatus)
  status?: PackStatus;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [PackItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackItemInputDto)
  items?: PackItemInputDto[];

  @ApiPropertyOptional({ type: [PackAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackAttributeInputDto)
  attributes?: PackAttributeInputDto[];
}
