import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SelectionType, SourceChannel } from '@prisma/client';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { QueryQuizQuestionsDto } from './dto/query-quiz-questions.dto';
import { QuizQuestionOptionInputDto } from './dto/quiz-question-option-input.dto';
import { ReorderQuizQuestionsDto } from './dto/reorder-quiz-questions.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async findQuestions() {
    const questions = await this.prisma.quizQuestion.findMany({
      where: {
        isActive: true,
        attributeGroup: {
          isActive: true,
        },
      },
      orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        questionText: true,
        helperText: true,
        selectionType: true,
        isRequired: true,
        stepOrder: true,
        attributeGroup: {
          select: {
            code: true,
            name: true,
          },
        },
        options: {
          where: {
            isActive: true,
            attributeOption: {
              isActive: true,
              attributeGroup: {
                isActive: true,
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }],
          select: {
            id: true,
            attributeOptionId: true,
            displayLabel: true,
            displayImageUrl: true,
            attributeOption: {
              select: {
                code: true,
                label: true,
              },
            },
          },
        },
      },
    });

    return questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      helperText: question.helperText,
      selectionType: question.selectionType,
      isRequired: question.isRequired,
      stepOrder: question.stepOrder,
      attributeGroup: question.attributeGroup,
      options: question.options.map((option) => ({
        id: option.id,
        attributeOptionId: option.attributeOptionId,
        code: option.attributeOption.code,
        label: option.attributeOption.label,
        displayLabel: option.displayLabel,
        displayImageUrl: option.displayImageUrl,
      })),
    }));
  }

  async createProfile(createCustomerProfileDto: CreateCustomerProfileDto) {
    const normalizedAnswers = createCustomerProfileDto.answers.map(
      (answer) => ({
        attributeGroupCode: answer.attributeGroupCode.trim().toUpperCase(),
        attributeOptionCode: answer.attributeOptionCode.trim().toUpperCase(),
      }),
    );

    this.validateNoDuplicateGroups(normalizedAnswers);

    const groupCodes = normalizedAnswers.map(
      (answer) => answer.attributeGroupCode,
    );

    const groups = await this.prisma.attributeGroup.findMany({
      where: {
        code: { in: groupCodes },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        options: {
          where: { isActive: true },
          select: {
            id: true,
            code: true,
          },
        },
        quizQuestions: {
          where: { isActive: true },
          orderBy: [{ stepOrder: 'asc' }],
          select: {
            id: true,
            isRequired: true,
            stepOrder: true,
          },
        },
      },
    });

    const groupByCode = new Map(groups.map((group) => [group.code, group]));

    for (const answer of normalizedAnswers) {
      const group = groupByCode.get(answer.attributeGroupCode);

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${answer.attributeGroupCode} is invalid or inactive.`,
        );
      }

      const option = group.options.find(
        (groupOption) => groupOption.code === answer.attributeOptionCode,
      );

      if (!option) {
        throw new BadRequestException(
          `Attribute option ${answer.attributeOptionCode} is invalid, inactive, or does not belong to ${answer.attributeGroupCode}.`,
        );
      }

      if (group.quizQuestions.length === 0) {
        throw new BadRequestException(
          `Attribute group ${answer.attributeGroupCode} has no active quiz question.`,
        );
      }
    }

    const requiredQuestions = await this.prisma.quizQuestion.findMany({
      where: {
        isActive: true,
        isRequired: true,
        attributeGroup: {
          isActive: true,
        },
      },
      select: {
        attributeGroup: {
          select: {
            code: true,
          },
        },
      },
    });

    const answeredGroupCodes = new Set(groupCodes);
    const missingRequiredGroupCodes = requiredQuestions
      .map((question) => question.attributeGroup?.code)
      .filter(
        (code): code is string =>
          typeof code === 'string' && !answeredGroupCodes.has(code),
      );

    if (missingRequiredGroupCodes.length > 0) {
      throw new BadRequestException(
        `Missing answers for required quiz questions: ${missingRequiredGroupCodes.join(', ')}.`,
      );
    }

    const answersToCreate = normalizedAnswers.map((answer) => {
      const group = groupByCode.get(answer.attributeGroupCode);

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${answer.attributeGroupCode} is invalid or inactive.`,
        );
      }

      const option = group.options.find(
        (groupOption) => groupOption.code === answer.attributeOptionCode,
      );
      const question = group.quizQuestions[0];

      if (!option || !question) {
        throw new BadRequestException(
          `Answer ${answer.attributeGroupCode}.${answer.attributeOptionCode} is not valid for the active quiz.`,
        );
      }

      return {
        attributeGroupCode: answer.attributeGroupCode,
        attributeOptionCode: answer.attributeOptionCode,
        questionId: question.id,
        attributeGroupId: group.id,
        attributeOptionId: option.id,
      };
    });

    const sourceChannel =
      createCustomerProfileDto.sourceChannel ?? SourceChannel.DIRECT;
    const sessionToken = randomUUID();

    const customerProfile = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.customerProfile.create({
        data: {
          sessionToken,
          sourceChannel,
          algorithmVersion: 'v1',
        },
      });

      await tx.customerProfileAnswer.createMany({
        data: answersToCreate.map((answer) => ({
          customerProfileId: profile.id,
          questionId: answer.questionId,
          attributeGroupId: answer.attributeGroupId,
          attributeOptionId: answer.attributeOptionId,
        })),
      });

      return profile;
    });

    return {
      customerProfileId: customerProfile.id,
      sessionToken: customerProfile.sessionToken,
      sourceChannel: customerProfile.sourceChannel,
      answers: answersToCreate.map((answer) => ({
        attributeGroupCode: answer.attributeGroupCode,
        attributeOptionCode: answer.attributeOptionCode,
      })),
    };
  }

  private validateNoDuplicateGroups(
    answers: Array<{ attributeGroupCode: string; attributeOptionCode: string }>,
  ) {
    const seenGroupCodes = new Set<string>();

    for (const answer of answers) {
      if (seenGroupCodes.has(answer.attributeGroupCode)) {
        throw new BadRequestException(
          `Duplicate answer for attribute group ${answer.attributeGroupCode}.`,
        );
      }

      seenGroupCodes.add(answer.attributeGroupCode);
    }
  }

  async adminFindQuestions(query: QueryQuizQuestionsDto) {
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'stepOrder';
    const sortOrder = query.sortOrder ?? 'asc';
    const where: Prisma.QuizQuestionWhereInput = {
      ...(query.attributeGroupId
        ? { attributeGroupId: query.attributeGroupId }
        : {}),
      ...(query.selectionType ? { selectionType: query.selectionType } : {}),
      ...(query.isRequired !== undefined
        ? { isRequired: query.isRequired }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? { questionText: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [questions, totalItems] = await this.prisma.$transaction([
      this.prisma.quizQuestion.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }],
        select: this.adminQuestionListSelect(),
      }),
      this.prisma.quizQuestion.count({ where }),
    ]);

    return paginatedResponse(
      questions.map((question) => this.toAdminQuestionListResponse(question)),
      { ...pagination, totalItems },
    );
  }

  async adminFindQuestion(id: string) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id },
      select: this.adminQuestionDetailSelect(),
    });

    if (!question) {
      throw new NotFoundException(`Quiz question ${id} was not found.`);
    }

    return this.toAdminQuestionDetailResponse(question);
  }

  async adminCreateQuestion(dto: CreateQuizQuestionDto) {
    const options = dto.options ?? [];
    const questionState = {
      attributeGroupId: dto.attributeGroupId,
      isActive: dto.isActive ?? false,
      selectionType: dto.selectionType ?? SelectionType.SINGLE,
      isRequired: dto.isRequired ?? true,
      stepOrder: dto.stepOrder ?? 0,
    };

    await this.validateQuestionState({
      questionId: undefined,
      attributeGroupId: questionState.attributeGroupId,
      isActive: questionState.isActive,
      options,
    });
    const resolvedOptions = await this.resolveQuestionOptions(
      questionState.attributeGroupId,
      questionState.isActive,
      options,
    );

    const question = await this.prisma.$transaction(async (tx) =>
      tx.quizQuestion.create({
        data: {
          attributeGroupId: questionState.attributeGroupId,
          questionText: dto.questionText,
          helperText: dto.helperText ?? null,
          selectionType: questionState.selectionType,
          isRequired: questionState.isRequired,
          stepOrder: questionState.stepOrder,
          isActive: questionState.isActive,
          options: {
            createMany: {
              data: resolvedOptions,
            },
          },
        },
        select: this.adminQuestionDetailSelect(),
      }),
    );

    return this.toAdminQuestionDetailResponse(question);
  }

  async adminUpdateQuestion(id: string, dto: UpdateQuizQuestionDto) {
    const existing = await this.prisma.quizQuestion.findUnique({
      where: { id },
      select: {
        id: true,
        attributeGroupId: true,
        isActive: true,
        options: {
          select: {
            attributeOptionId: true,
            displayLabel: true,
            displayImageUrl: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Quiz question ${id} was not found.`);
    }

    const finalAttributeGroupId =
      dto.attributeGroupId ?? existing.attributeGroupId;
    if (!finalAttributeGroupId) {
      throw new BadRequestException('attributeGroupId is required.');
    }

    const finalIsActive = dto.isActive ?? existing.isActive;
    const optionsIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'options',
    );
    const optionInputs = optionsIncluded
      ? (dto.options ?? [])
      : existing.options.map((option) => ({
          attributeOptionId: option.attributeOptionId,
          displayLabel: option.displayLabel,
          displayImageUrl: option.displayImageUrl,
          sortOrder: option.sortOrder,
          isActive: option.isActive,
        }));

    await this.validateQuestionState({
      questionId: id,
      attributeGroupId: finalAttributeGroupId,
      isActive: finalIsActive,
      options: optionInputs,
    });
    const resolvedOptions = await this.resolveQuestionOptions(
      finalAttributeGroupId,
      finalIsActive,
      optionInputs,
    );

    const question = await this.prisma.$transaction(async (tx) => {
      if (optionsIncluded) {
        await tx.quizQuestionOption.deleteMany({ where: { questionId: id } });
      }

      return tx.quizQuestion.update({
        where: { id },
        data: {
          ...(dto.attributeGroupId !== undefined
            ? { attributeGroupId: dto.attributeGroupId }
            : {}),
          ...(dto.questionText !== undefined
            ? { questionText: dto.questionText }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'helperText')
            ? { helperText: dto.helperText ?? null }
            : {}),
          ...(dto.selectionType !== undefined
            ? { selectionType: dto.selectionType }
            : {}),
          ...(dto.isRequired !== undefined
            ? { isRequired: dto.isRequired }
            : {}),
          ...(dto.stepOrder !== undefined ? { stepOrder: dto.stepOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(optionsIncluded
            ? {
                options: {
                  createMany: {
                    data: resolvedOptions,
                  },
                },
              }
            : {}),
        },
        select: this.adminQuestionDetailSelect(),
      });
    });

    return this.toAdminQuestionDetailResponse(question);
  }

  async adminDeactivateQuestion(id: string) {
    await this.ensureQuestionExists(id);

    const question = await this.prisma.quizQuestion.update({
      where: { id },
      data: { isActive: false },
      select: this.adminQuestionDetailSelect(),
    });

    return this.toAdminQuestionDetailResponse(question);
  }

  async adminReorderQuestions(dto: ReorderQuizQuestionsDto) {
    const questionIds = dto.questions.map((question) => question.questionId);
    const stepOrders = dto.questions.map((question) => question.stepOrder);

    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Question IDs must be unique.');
    }

    if (new Set(stepOrders).size !== stepOrders.length) {
      throw new BadRequestException('Step orders must be unique.');
    }

    const existingCount = await this.prisma.quizQuestion.count({
      where: { id: { in: questionIds } },
    });

    if (existingCount !== questionIds.length) {
      throw new NotFoundException('One or more quiz questions were not found.');
    }

    await this.prisma.$transaction(
      dto.questions.map((question) =>
        this.prisma.quizQuestion.update({
          where: { id: question.questionId },
          data: { stepOrder: question.stepOrder },
        }),
      ),
    );

    return { updatedCount: dto.questions.length };
  }

  private adminQuestionListSelect() {
    return {
      id: true,
      attributeGroupId: true,
      questionText: true,
      helperText: true,
      selectionType: true,
      isRequired: true,
      stepOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      attributeGroup: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          options: true,
          answers: true,
        },
      },
      options: {
        where: { isActive: true },
        select: { id: true },
      },
    } satisfies Prisma.QuizQuestionSelect;
  }

  private adminQuestionDetailSelect() {
    return {
      id: true,
      attributeGroupId: true,
      questionText: true,
      helperText: true,
      selectionType: true,
      isRequired: true,
      stepOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      attributeGroup: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
      options: {
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          id: true,
          attributeOptionId: true,
          displayLabel: true,
          displayImageUrl: true,
          sortOrder: true,
          isActive: true,
          attributeOption: {
            select: {
              id: true,
              code: true,
              label: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          answers: true,
        },
      },
    } satisfies Prisma.QuizQuestionSelect;
  }

  private toAdminQuestionListResponse(question: any) {
    return {
      id: question.id,
      attributeGroupId: question.attributeGroupId,
      questionText: question.questionText,
      helperText: question.helperText,
      selectionType: question.selectionType,
      isRequired: question.isRequired,
      stepOrder: question.stepOrder,
      isActive: question.isActive,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      attributeGroup: question.attributeGroup,
      optionCount: question._count.options,
      activeOptionCount: question.options.length,
      answerUsageCount: question._count.answers,
    };
  }

  private toAdminQuestionDetailResponse(question: any) {
    return {
      id: question.id,
      attributeGroupId: question.attributeGroupId,
      questionText: question.questionText,
      helperText: question.helperText,
      selectionType: question.selectionType,
      isRequired: question.isRequired,
      stepOrder: question.stepOrder,
      isActive: question.isActive,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      attributeGroup: question.attributeGroup,
      answerUsageCount: question._count.answers,
      options: question.options,
    };
  }

  private async validateQuestionState(input: {
    questionId?: string;
    attributeGroupId: string;
    isActive: boolean;
    options: QuizQuestionOptionInputDto[];
  }) {
    const group = await this.prisma.attributeGroup.findUnique({
      where: { id: input.attributeGroupId },
      select: { id: true, isActive: true },
    });

    if (!group) {
      throw new NotFoundException(
        `Attribute group ${input.attributeGroupId} was not found.`,
      );
    }

    if (input.isActive && !group.isActive) {
      throw new BadRequestException(
        'Active quiz question requires an active attribute group.',
      );
    }

    if (input.isActive) {
      const activeSibling = await this.prisma.quizQuestion.findFirst({
        where: {
          attributeGroupId: input.attributeGroupId,
          isActive: true,
          ...(input.questionId ? { id: { not: input.questionId } } : {}),
        },
        select: { id: true },
      });

      if (activeSibling) {
        throw new ConflictException(
          'Only one active quiz question is allowed per attribute group.',
        );
      }

      if (input.options.length === 0) {
        throw new BadRequestException(
          'Active quiz question requires at least one option.',
        );
      }

      if (!input.options.some((option) => option.isActive ?? true)) {
        throw new BadRequestException(
          'Active quiz question requires at least one active option.',
        );
      }
    }
  }

  private async resolveQuestionOptions(
    attributeGroupId: string,
    questionIsActive: boolean,
    options: QuizQuestionOptionInputDto[],
  ) {
    const seenOptionIds = new Set<string>();
    const resolved: Array<{
      attributeOptionId: string;
      displayLabel: string | null;
      displayImageUrl: string | null;
      sortOrder: number;
      isActive: boolean;
    }> = [];

    for (const option of options) {
      if (seenOptionIds.has(option.attributeOptionId)) {
        throw new BadRequestException(
          'Duplicate quiz question option mapping.',
        );
      }

      seenOptionIds.add(option.attributeOptionId);

      const attributeOption = await this.prisma.attributeOption.findUnique({
        where: { id: option.attributeOptionId },
        select: {
          id: true,
          attributeGroupId: true,
          isActive: true,
        },
      });

      if (!attributeOption) {
        throw new NotFoundException(
          `Attribute option ${option.attributeOptionId} was not found.`,
        );
      }

      if (attributeOption.attributeGroupId !== attributeGroupId) {
        throw new BadRequestException(
          'Quiz question option must belong to the question attribute group.',
        );
      }

      const optionIsActive = option.isActive ?? true;
      if (questionIsActive && optionIsActive && !attributeOption.isActive) {
        throw new BadRequestException(
          'Active quiz question options must use active attribute options.',
        );
      }

      resolved.push({
        attributeOptionId: option.attributeOptionId,
        displayLabel: option.displayLabel ?? null,
        displayImageUrl: option.displayImageUrl ?? null,
        sortOrder: option.sortOrder ?? 0,
        isActive: optionIsActive,
      });
    }

    return resolved;
  }

  private async ensureQuestionExists(id: string) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!question) {
      throw new NotFoundException(`Quiz question ${id} was not found.`);
    }
  }
}
