import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryPublicProductDetailDto {
  @ApiPropertyOptional({
    description:
      'Preferred active product reference to select in the PDP response.',
    example: '00000000-0000-4000-8000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  selectedReferenceId?: string;
}
