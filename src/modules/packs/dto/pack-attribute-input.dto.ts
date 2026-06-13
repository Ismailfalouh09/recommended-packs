import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { optionalUppercase } from '../../../common/transforms/query.transforms';

export class PackAttributeInputDto {
  @ApiProperty({ example: 'STYLE' })
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  @IsNotEmpty()
  attributeGroupCode!: string;

  @ApiProperty({ example: 'NATURAL' })
  @Transform(({ value }) => optionalUppercase(value))
  @IsString()
  @IsNotEmpty()
  attributeOptionCode!: string;

  @ApiProperty({ enum: MatchType, example: MatchType.COMPATIBLE })
  @IsEnum(MatchType)
  matchType!: MatchType;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  scoreValue!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isHardFilter?: boolean;
}
