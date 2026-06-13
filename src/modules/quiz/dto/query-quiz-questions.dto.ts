import { ApiPropertyOptional } from '@nestjs/swagger';
import { SelectionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  optionalBoolean,
  optionalTrimmedString,
} from '../../../common/transforms/query.transforms';

export class QueryQuizQuestionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'coverage' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsOptional()
  @IsUUID()
  attributeGroupId?: string;

  @ApiPropertyOptional({ enum: SelectionType })
  @IsOptional()
  @IsEnum(SelectionType)
  selectionType?: SelectionType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['stepOrder', 'createdAt', 'questionText'] })
  @IsOptional()
  @IsIn(['stepOrder', 'createdAt', 'questionText'])
  sortBy?: 'stepOrder' | 'createdAt' | 'questionText';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
