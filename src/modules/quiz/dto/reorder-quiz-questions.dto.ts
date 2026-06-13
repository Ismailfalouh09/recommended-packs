import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderQuizQuestionItemDto {
  @ApiProperty({ example: '9f72caaa-f55b-4423-b805-911e3e7f61bb' })
  @IsUUID()
  questionId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stepOrder!: number;
}

export class ReorderQuizQuestionsDto {
  @ApiProperty({ type: [ReorderQuizQuestionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderQuizQuestionItemDto)
  questions!: ReorderQuizQuestionItemDto[];
}
