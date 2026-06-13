import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SelectionMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class PackItemInputDto {
  @ApiProperty({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  productReferenceId?: string | null;

  @ApiProperty({
    enum: SelectionMode,
    example: SelectionMode.AUTO_BEST_REFERENCE,
  })
  @IsEnum(SelectionMode)
  selectionMode!: SelectionMode;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
