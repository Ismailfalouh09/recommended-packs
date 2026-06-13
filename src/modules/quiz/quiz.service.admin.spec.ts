import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SelectionType } from '@prisma/client';
import { QuizService } from './quiz.service';

describe('QuizService admin', () => {
  let prisma: any;
  let tx: any;
  let service: QuizService;

  beforeEach(() => {
    tx = {
      quizQuestion: {
        create: jest.fn().mockResolvedValue(questionFixture()),
        update: jest
          .fn()
          .mockResolvedValue(questionFixture({ questionText: 'Updated' })),
      },
      quizQuestionOption: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma = {
      $transaction: jest.fn((input: any) =>
        Array.isArray(input) ? Promise.all(input) : input(tx),
      ),
      quizQuestion: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockResolvedValue(questionFixture({ isActive: false })),
      },
      attributeGroup: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'group-1', isActive: true }),
      },
      attributeOption: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'option-1',
          attributeGroupId: 'group-1',
          isActive: true,
        }),
      },
    };
    service = new QuizService(prisma);
  });

  it('creates a draft question without options', async () => {
    const result = await service.adminCreateQuestion({
      attributeGroupId: 'group-1',
      questionText: 'What coverage do you prefer?',
      isActive: false,
    });

    expect(result.questionText).toBe('What coverage do you prefer?');
    expect(tx.quizQuestion.create).toHaveBeenCalled();
  });

  it('creates an active question with options', async () => {
    const result = await service.adminCreateQuestion({
      attributeGroupId: 'group-1',
      questionText: 'What coverage do you prefer?',
      selectionType: SelectionType.SINGLE,
      isActive: true,
      options: [optionInput()],
    });

    expect(result.isActive).toBe(true);
  });

  it('rejects active questions without options', async () => {
    await expect(
      service.adminCreateQuestion({
        attributeGroupId: 'group-1',
        questionText: 'What coverage do you prefer?',
        isActive: true,
        options: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects option from wrong group', async () => {
    prisma.attributeOption.findUnique.mockResolvedValue({
      id: 'option-1',
      attributeGroupId: 'other-group',
      isActive: true,
    });

    await expect(
      service.adminCreateQuestion({
        attributeGroupId: 'group-1',
        questionText: 'Question',
        isActive: true,
        options: [optionInput()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate option mappings', async () => {
    await expect(
      service.adminCreateQuestion({
        attributeGroupId: 'group-1',
        questionText: 'Question',
        isActive: true,
        options: [optionInput(), optionInput()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second active question for the same group', async () => {
    prisma.quizQuestion.findFirst.mockResolvedValue({
      id: 'question-existing',
    });

    await expect(
      service.adminCreateQuestion({
        attributeGroupId: 'group-1',
        questionText: 'Question',
        isActive: true,
        options: [optionInput()],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('partial update preserves omitted options', async () => {
    prisma.quizQuestion.findUnique.mockResolvedValue(existingQuestionFixture());

    await service.adminUpdateQuestion('question-1', {
      questionText: 'Updated',
    });

    expect(tx.quizQuestionOption.deleteMany).not.toHaveBeenCalled();
  });

  it('supplied options replace mappings', async () => {
    prisma.quizQuestion.findUnique.mockResolvedValue(existingQuestionFixture());

    await service.adminUpdateQuestion('question-1', {
      options: [optionInput()],
    });

    expect(tx.quizQuestionOption.deleteMany).toHaveBeenCalledWith({
      where: { questionId: 'question-1' },
    });
  });

  it('invalid replacement rolls back before transaction', async () => {
    prisma.quizQuestion.findUnique.mockResolvedValue(existingQuestionFixture());
    prisma.attributeOption.findUnique.mockResolvedValue(null);

    await expect(
      service.adminUpdateQuestion('question-1', { options: [optionInput()] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('soft-deactivates question', async () => {
    prisma.quizQuestion.findUnique.mockResolvedValue({ id: 'question-1' });

    await service.adminDeactivateQuestion('question-1');

    expect(prisma.quizQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('reorders questions transactionally', async () => {
    prisma.quizQuestion.count.mockResolvedValue(2);

    const result = await service.adminReorderQuestions({
      questions: [
        { questionId: '11111111-1111-4111-8111-111111111111', stepOrder: 1 },
        { questionId: '22222222-2222-4222-8222-222222222222', stepOrder: 2 },
      ],
    });

    expect(result.updatedCount).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('public questions exclude inactive groups and inactive options', async () => {
    await service.findQuestions();

    expect(prisma.quizQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          attributeGroup: { isActive: true },
        },
        select: expect.objectContaining({
          options: expect.objectContaining({
            where: expect.objectContaining({
              isActive: true,
              attributeOption: expect.objectContaining({
                isActive: true,
              }),
            }),
          }),
        }),
      }),
    );
  });
});

function optionInput() {
  return {
    attributeOptionId: 'option-1',
    sortOrder: 1,
    isActive: true,
  };
}

function existingQuestionFixture() {
  return {
    id: 'question-1',
    attributeGroupId: 'group-1',
    isActive: true,
    options: [optionInput()],
  };
}

function questionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'question-1',
    attributeGroupId: 'group-1',
    questionText: 'What coverage do you prefer?',
    helperText: null,
    selectionType: SelectionType.SINGLE,
    isRequired: true,
    stepOrder: 1,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    attributeGroup: {
      id: 'group-1',
      code: 'COVERAGE',
      name: 'Coverage',
      isActive: true,
    },
    options: [
      {
        id: 'question-option-1',
        attributeOptionId: 'option-1',
        displayLabel: null,
        displayImageUrl: null,
        sortOrder: 1,
        isActive: true,
        attributeOption: {
          id: 'option-1',
          code: 'FULL',
          label: 'Full',
          isActive: true,
        },
      },
    ],
    _count: { answers: 0 },
    ...overrides,
  };
}
