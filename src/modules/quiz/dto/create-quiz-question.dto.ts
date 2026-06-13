import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SelectionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { optionalTrimmedString } from '../../../common/transforms/query.transforms';
import { QuizQuestionOptionInputDto } from './quiz-question-option-input.dto';

export class CreateQuizQuestionDto {
  @ApiProperty({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsUUID()
  attributeGroupId!: string;

  @ApiProperty({ example: 'What coverage do you prefer?' })
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @ApiPropertyOptional({ example: 'Choose your preferred result' })
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  helperText?: string | null;

  @ApiPropertyOptional({ enum: SelectionType, default: SelectionType.SINGLE })
  @IsOptional()
  @IsEnum(SelectionType)
  selectionType?: SelectionType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 6, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stepOrder?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [QuizQuestionOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionOptionInputDto)
  options?: QuizQuestionOptionInputDto[];
}
