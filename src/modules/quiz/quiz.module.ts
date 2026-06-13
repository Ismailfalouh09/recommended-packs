import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminQuizController } from './admin-quiz.controller';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuizController, AdminQuizController],
  providers: [QuizService],
})
export class QuizModule {}
