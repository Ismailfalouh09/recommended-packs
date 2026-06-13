import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRecommendationRuleDto } from './create-recommendation-rule.dto';

export class UpdateRecommendationRuleDto extends PartialType(
  OmitType(CreateRecommendationRuleDto, ['code'] as const),
) {}
