import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CustomerProfileResponse,
  QuizQuestionResponse,
} from '../../common/swagger/api-response.models';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { QuizService } from './quiz.service';

@ApiTags('Quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  @ApiOperation({
    summary: 'List active quiz questions',
    description:
      'Returns active quiz questions with active selectable options ordered by step.',
  })
  @ApiOkResponse({
    description: 'Active quiz questions.',
    type: [QuizQuestionResponse],
  })
  findQuestions() {
    return this.quizService.findQuestions();
  }

  @Post('profiles')
  @ApiOperation({
    summary: 'Create a customer quiz profile',
    description:
      'Validates quiz answers, required questions, duplicate groups, and option membership before creating a customer profile and answers in one transaction.',
  })
  @ApiCreatedResponse({
    description: 'Customer profile created.',
    type: CustomerProfileResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid group, invalid option, duplicate answer, or missing required answer.',
  })
  createProfile(@Body() createCustomerProfileDto: CreateCustomerProfileDto) {
    return this.quizService.createProfile(createCustomerProfileDto);
  }
}
