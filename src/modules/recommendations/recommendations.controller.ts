import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RecommendationResponse } from '../../common/swagger/api-response.models';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Generate recommendations for a customer profile',
    description:
      'Loads profile answers and active packs/products/references, selects best references, stores the recommendation session/results/items, and returns ranked packs with score details.',
  })
  @ApiCreatedResponse({
    description: 'Recommendations generated and stored.',
    type: RecommendationResponse,
  })
  @ApiBadRequestResponse({
    description: 'Profile has no answers or request validation failed.',
  })
  @ApiNotFoundResponse({ description: 'Customer profile not found.' })
  create(@Body() createRecommendationDto: CreateRecommendationDto) {
    return this.recommendationsService.create(createRecommendationDto);
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Get a stored recommendation session',
    description:
      'Returns a previously generated recommendation session and ranked results.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Recommendation session ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Stored recommendation session.',
    type: RecommendationResponse,
  })
  @ApiNotFoundResponse({ description: 'Recommendation session not found.' })
  findOne(@Param('sessionId') sessionId: string) {
    return this.recommendationsService.findOne(sessionId);
  }
}
