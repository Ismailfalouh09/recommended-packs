import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PackAllowedAddOnInputDto {
  @ApiProperty({
    description: 'Allowed add-on Product ID.',
    example: '00000000-0000-4000-8000-000000000030',
  })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Optional pinned ProductReference ID. When omitted, any active reference of the product may be chosen.',
    example: '00000000-0000-4000-8000-000000000031',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  productReferenceId?: string | null;
}
