import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminRecommendationRulesController } from './admin-recommendation-rules.controller';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationsController, AdminRecommendationRulesController],
  providers: [RecommendationsService, RecommendationEngineService],
})
export class RecommendationsModule {}
