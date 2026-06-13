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

export class ReorderMediaItemDto {
  @ApiProperty({
    description: 'Product or pack image relation ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  imageId!: string;

  @ApiProperty({
    description: 'New non-negative display position.',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderMediaDto {
  @ApiProperty({ type: [ReorderMediaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderMediaItemDto)
  items!: ReorderMediaItemDto[];
}
