import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SourceChannel } from '@prisma/client';

export class CreateCustomerProfileAnswerDto {
  @ApiProperty({
    description: 'Attribute group code being answered.',
    example: 'SKIN_COLOR',
  })
  @IsString()
  @IsNotEmpty()
  attributeGroupCode: string;

  @ApiProperty({
    description: 'Attribute option code selected for the group.',
    example: 'MEDIUM',
  })
  @IsString()
  @IsNotEmpty()
  attributeOptionCode: string;
}

export class CreateCustomerProfileDto {
  @ApiPropertyOptional({
    description:
      'Customer acquisition channel. Defaults to DIRECT when omitted.',
    enum: SourceChannel,
    example: SourceChannel.INSTAGRAM,
  })
  @IsOptional()
  @IsEnum(SourceChannel)
  sourceChannel?: SourceChannel;

  @ApiProperty({
    description:
      'Non-empty list of quiz answers. One answer per attribute group.',
    type: [CreateCustomerProfileAnswerDto],
    example: [
      { attributeGroupCode: 'SKIN_COLOR', attributeOptionCode: 'MEDIUM' },
      { attributeGroupCode: 'UNDERTONE', attributeOptionCode: 'WARM' },
      { attributeGroupCode: 'SKIN_TYPE', attributeOptionCode: 'OILY' },
      { attributeGroupCode: 'STYLE', attributeOptionCode: 'NATURAL' },
      { attributeGroupCode: 'BUDGET', attributeOptionCode: 'MEDIUM' },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerProfileAnswerDto)
  answers: CreateCustomerProfileAnswerDto[];
}
