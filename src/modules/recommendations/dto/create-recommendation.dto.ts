import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateRecommendationDto {
  @ApiProperty({
    description: 'Customer profile ID returned by POST /quiz/profiles.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  customerProfileId: string;
}
