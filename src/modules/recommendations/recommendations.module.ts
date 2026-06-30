import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AdminRecommendationRulesController } from './admin-recommendation-rules.controller';
import { PackEligibilityService } from './eligibility/pack-eligibility.service';
import { RecommendationExplanationService } from './explanation/recommendation-explanation.service';
import { BudgetMatcher } from './matching/budget.matcher';
import { MakeupStyleMatcher } from './matching/makeup-style.matcher';
import { OccasionMatcher } from './matching/occasion.matcher';
import { SkinToneMatcher } from './matching/skin-tone.matcher';
import { SkinTypeMatcher } from './matching/skin-type.matcher';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationUseCaseService } from './recommendation-use-case.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { PackScoreAggregatorService } from './scoring/pack-score-aggregator.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [RecommendationsController, AdminRecommendationRulesController],
  providers: [
    RecommendationsService,
    RecommendationEngineService,
    // Pack Recommendation MVP — five-criterion algorithm collaborators.
    PackEligibilityService,
    PackScoreAggregatorService,
    RecommendationExplanationService,
    SkinToneMatcher,
    SkinTypeMatcher,
    MakeupStyleMatcher,
    BudgetMatcher,
    OccasionMatcher,
    RecommendationUseCaseService,
  ],
})
export class RecommendationsModule {}
