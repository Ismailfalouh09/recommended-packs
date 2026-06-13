import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { QuizQuestionResponse } from '../../common/swagger/api-response.models';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { QueryQuizQuestionsDto } from './dto/query-quiz-questions.dto';
import { ReorderQuizQuestionsDto } from './dto/reorder-quiz-questions.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';
import { QuizService } from './quiz.service';

@ApiTags('Admin Quiz')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/quiz/questions')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminQuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin quiz questions',
    description: 'OWNER, ADMIN, and STAFF can read paginated quiz questions.',
  })
  @ApiOkResponse({
    description: 'Paginated quiz questions.',
    type: QuizQuestionResponse,
  })
  findAll(@Query() query: QueryQuizQuestionsDto) {
    return this.quizService.adminFindQuestions(query);
  }

  @Patch('reorder')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Reorder quiz questions',
    description: 'OWNER and ADMIN can update quiz question step order in bulk.',
  })
  @ApiOkResponse({ description: 'Quiz questions reordered.' })
  reorder(@Body() dto: ReorderQuizQuestionsDto) {
    return this.quizService.adminReorderQuestions(dto);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin quiz question details',
    description: 'OWNER, ADMIN, and STAFF can read quiz question details.',
  })
  @ApiOkResponse({
    description: 'Quiz question details.',
    type: QuizQuestionResponse,
  })
  @ApiNotFoundResponse({ description: 'Quiz question not found.' })
  findOne(@Param('id') id: string) {
    return this.quizService.adminFindQuestion(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create quiz question',
    description:
      'OWNER and ADMIN can create quiz questions and mapped answer options. Only one active question is allowed per attribute group.',
  })
  @ApiOkResponse({ description: 'Quiz question created.' })
  @ApiConflictResponse({
    description: 'Only one active question is allowed per attribute group.',
  })
  create(@Body() dto: CreateQuizQuestionDto) {
    return this.quizService.adminCreateQuestion(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update quiz question',
    description:
      'OWNER and ADMIN can update quiz question fields and replace options. Active uniqueness per attribute group is enforced.',
  })
  @ApiOkResponse({ description: 'Quiz question updated.' })
  @ApiNotFoundResponse({ description: 'Quiz question not found.' })
  @ApiConflictResponse({
    description: 'Only one active question is allowed per attribute group.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateQuizQuestionDto) {
    return this.quizService.adminUpdateQuestion(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate quiz question',
    description: 'OWNER and ADMIN can soft-deactivate quiz questions.',
  })
  @ApiOkResponse({ description: 'Quiz question deactivated.' })
  @ApiNotFoundResponse({ description: 'Quiz question not found.' })
  deactivate(@Param('id') id: string) {
    return this.quizService.adminDeactivateQuestion(id);
  }
}
