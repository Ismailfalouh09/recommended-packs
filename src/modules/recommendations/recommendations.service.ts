import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackStatus,
  Prisma,
  RecommendationConditionType,
  RecommendationStatus,
  RecommendationTargetType,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { CreateRecommendationRuleDto } from './dto/create-recommendation-rule.dto';
import { QueryRecommendationRulesDto } from './dto/query-recommendation-rules.dto';
import { UpdateRecommendationRuleDto } from './dto/update-recommendation-rule.dto';
import {
  EnginePack,
  EngineRecommendation,
  RecommendationEngineService,
  RuleScores,
} from './recommendation-engine.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationEngine: RecommendationEngineService,
  ) {}

  async create(createRecommendationDto: CreateRecommendationDto) {
    const calculated = await this.calculateRecommendations(
      createRecommendationDto.customerProfileId,
    );

    const stored = await this.prisma.$transaction(async (tx) => {
      const recommendationSession = await tx.recommendationSession.create({
        data: {
          customerProfileId: calculated.customerProfileId,
          algorithmVersion: 'v1',
          totalCandidatePacks: calculated.totalCandidatePacks,
          totalRecommendedPacks: calculated.recommendations.length,
          status: RecommendationStatus.COMPLETED,
        },
      });
      const recommendationResultIds = new Map<string, string>();

      for (const recommendation of calculated.recommendations) {
        const result = await tx.recommendationResult.create({
          data: {
            recommendationSessionId: recommendationSession.id,
            packId: recommendation.packId,
            rank: recommendation.rank,
            totalScore: recommendation.totalScore,
            matchPercentage: recommendation.matchPercentage,
            reasonSummary: `Matched ${recommendation.packName} with score ${recommendation.totalScore}.`,
            reasonJson: recommendation.reason as Prisma.InputJsonValue,
          },
        });
        recommendationResultIds.set(recommendation.packId, result.id);

        await tx.recommendationResultItem.createMany({
          data: recommendation.selectedItems.map((item) => ({
            recommendationResultId: result.id,
            packItemId: item.packItemId,
            productId: item.productId,
            selectedProductReferenceId: item.referenceId,
            quantity: item.quantity,
            itemScore: item.itemScore,
            reasonJson: item.reason as Prisma.InputJsonValue,
          })),
        });
      }

      return { recommendationSession, recommendationResultIds };
    });

    return {
      sessionId: stored.recommendationSession.id,
      recommendedPacks: this.toRecommendationResponse(
        calculated.recommendations,
        stored.recommendationResultIds,
      ),
    };
  }

  async preview(createRecommendationDto: CreateRecommendationDto) {
    const calculated = await this.calculateRecommendations(
      createRecommendationDto.customerProfileId,
    );

    return {
      customerProfileId: calculated.customerProfileId,
      totalCandidatePacks: calculated.totalCandidatePacks,
      totalRecommendedPacks: calculated.recommendations.length,
      recommendedPacks: this.toRecommendationResponse(
        calculated.recommendations,
      ),
    };
  }

  private async calculateRecommendations(customerProfileId: string) {
    const customerProfile = await this.loadCustomerProfile(customerProfileId);
    const answers = this.buildAnswerMap(customerProfile.answers);

    if (Object.keys(answers).length === 0) {
      throw new BadRequestException('Customer profile has no quiz answers.');
    }

    const [packs, ruleScores] = await Promise.all([
      this.loadActivePacks(),
      this.loadRuleScores(),
    ]);

    const recommendations = this.recommendationEngine.generateRecommendations({
      answers,
      packs,
      ruleScores,
    });

    return {
      customerProfileId: customerProfile.id,
      totalCandidatePacks: packs.length,
      recommendations,
    };
  }

  async findOne(sessionId: string) {
    const session = await this.prisma.recommendationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        customerProfileId: true,
        algorithmVersion: true,
        totalCandidatePacks: true,
        totalRecommendedPacks: true,
        status: true,
        createdAt: true,
        results: {
          orderBy: [{ rank: 'asc' }],
          select: {
            id: true,
            packId: true,
            rank: true,
            totalScore: true,
            matchPercentage: true,
            reasonSummary: true,
            reasonJson: true,
            pack: {
              select: {
                name: true,
              },
            },
            items: {
              orderBy: [{ createdAt: 'asc' }],
              select: {
                id: true,
                packItemId: true,
                productId: true,
                selectedProductReferenceId: true,
                quantity: true,
                itemScore: true,
                reasonJson: true,
                product: {
                  select: {
                    name: true,
                  },
                },
                selectedProductReference: {
                  select: {
                    referenceCode: true,
                    referenceName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(
        `Recommendation session ${sessionId} was not found.`,
      );
    }

    return {
      sessionId: session.id,
      customerProfileId: session.customerProfileId,
      algorithmVersion: session.algorithmVersion,
      totalCandidatePacks: session.totalCandidatePacks,
      totalRecommendedPacks: session.totalRecommendedPacks,
      status: session.status,
      createdAt: session.createdAt,
      recommendedPacks: session.results.map((result) => ({
        recommendationResultId: result.id,
        packId: result.packId,
        packName: result.pack.name,
        rank: result.rank,
        totalScore: result.totalScore,
        matchPercentage: Number(result.matchPercentage),
        reasonSummary: result.reasonSummary,
        reason: result.reasonJson,
        selectedItems: result.items.map((item) => ({
          recommendationResultItemId: item.id,
          packItemId: item.packItemId,
          productId: item.productId,
          productName: item.product.name,
          referenceId: item.selectedProductReferenceId,
          referenceName: `${item.selectedProductReference.referenceCode} ${item.selectedProductReference.referenceName}`,
          quantity: item.quantity,
          itemScore: item.itemScore,
          reason: item.reasonJson,
        })),
      })),
    };
  }

  private async loadCustomerProfile(customerProfileId: string) {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: {
        id: true,
        answers: {
          select: {
            attributeGroup: {
              select: {
                code: true,
              },
            },
            attributeOption: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!customerProfile) {
      throw new NotFoundException(
        `Customer profile ${customerProfileId} was not found.`,
      );
    }

    return customerProfile;
  }

  private buildAnswerMap(
    answers: Array<{
      attributeGroup: { code: string };
      attributeOption: { code: string } | null;
    }>,
  ) {
    return answers.reduce<Record<string, string>>((answerMap, answer) => {
      if (answer.attributeOption) {
        answerMap[answer.attributeGroup.code] = answer.attributeOption.code;
      }

      return answerMap;
    }, {});
  }

  private async loadActivePacks(): Promise<EnginePack[]> {
    return this.prisma.pack.findMany({
      where: {
        status: PackStatus.ACTIVE,
        isActive: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        priority: true,
        attributes: {
          select: {
            matchType: true,
            scoreValue: true,
            isHardFilter: true,
            attributeGroup: {
              select: {
                code: true,
              },
            },
            attributeOption: {
              select: {
                code: true,
              },
            },
          },
        },
        items: {
          orderBy: [{ sortOrder: 'asc' }],
          select: {
            id: true,
            productReferenceId: true,
            quantity: true,
            selectionMode: true,
            isRequired: true,
            product: {
              select: {
                id: true,
                name: true,
                isActive: true,
                status: true,
                references: {
                  where: {
                    isActive: true,
                    stockQuantity: {
                      gt: 0,
                    },
                  },
                  select: {
                    id: true,
                    referenceCode: true,
                    referenceName: true,
                    stockQuantity: true,
                    reservedQuantity: true,
                    isActive: true,
                    attributes: {
                      select: {
                        matchType: true,
                        scoreValue: true,
                        isHardFilter: true,
                        attributeGroup: {
                          select: {
                            code: true,
                          },
                        },
                        attributeOption: {
                          select: {
                            code: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async loadRuleScores(): Promise<RuleScores> {
    const rules = await this.prisma.recommendationRule.findMany({
      where: { isActive: true },
      select: {
        code: true,
        scoreValue: true,
        weight: true,
      },
    });

    return rules.reduce<RuleScores>((scores, rule) => {
      scores[rule.code] = Math.round(
        rule.scoreValue * (toMoneyNumber(rule.weight) ?? 1),
      );
      return scores;
    }, {});
  }

  private toRecommendationResponse(
    recommendations: EngineRecommendation[],
    recommendationResultIds?: Map<string, string>,
  ) {
    return recommendations.map((recommendation) => ({
      recommendationResultId: recommendationResultIds?.get(
        recommendation.packId,
      ),
      packId: recommendation.packId,
      packName: recommendation.packName,
      rank: recommendation.rank,
      totalScore: recommendation.totalScore,
      matchPercentage: recommendation.matchPercentage,
      reason: recommendation.reason,
      selectedItems: recommendation.selectedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        referenceId: item.referenceId,
        referenceName: item.referenceName,
        quantity: item.quantity,
        itemScore: item.itemScore,
        reason: item.reason,
      })),
    }));
  }

  async adminFindRules(query: QueryRecommendationRulesDto) {
    const pagination = paginationParams(query);
    const where: Prisma.RecommendationRuleWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.conditionType ? { conditionType: query.conditionType } : {}),
      ...(query.attributeGroupId
        ? { attributeGroupId: query.attributeGroupId }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rules, totalItems] = await this.prisma.$transaction([
      this.prisma.recommendationRule.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ code: 'asc' }],
        select: this.adminRuleSelect(),
      }),
      this.prisma.recommendationRule.count({ where }),
    ]);

    return paginatedResponse(
      rules.map((rule) => this.toAdminRuleResponse(rule)),
      { ...pagination, totalItems },
    );
  }

  async adminFindRule(id: string) {
    const rule = await this.prisma.recommendationRule.findUnique({
      where: { id },
      select: this.adminRuleSelect(),
    });

    if (!rule) {
      throw new NotFoundException(`Recommendation rule ${id} was not found.`);
    }

    return this.toAdminRuleResponse(rule);
  }

  async adminCreateRule(dto: CreateRecommendationRuleDto) {
    await this.ensureUniqueRuleCode(dto.code);
    await this.validateRuleAttributeGroup(
      dto.attributeGroupId,
      dto.isActive ?? true,
    );

    const rule = await this.prisma.recommendationRule.create({
      data: {
        code: dto.code,
        name: dto.name,
        targetType: dto.targetType,
        attributeGroupId: dto.attributeGroupId ?? null,
        conditionType: dto.conditionType,
        scoreValue: dto.scoreValue,
        weight: dto.weight ?? 1,
        isActive: dto.isActive ?? true,
      },
      select: this.adminRuleSelect(),
    });

    return this.toAdminRuleResponse(rule);
  }

  async adminUpdateRule(id: string, dto: UpdateRecommendationRuleDto) {
    const existing = await this.prisma.recommendationRule.findUnique({
      where: { id },
      select: {
        id: true,
        attributeGroupId: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Recommendation rule ${id} was not found.`);
    }

    const finalAttributeGroupId = Object.prototype.hasOwnProperty.call(
      dto,
      'attributeGroupId',
    )
      ? dto.attributeGroupId
      : existing.attributeGroupId;
    const finalIsActive = dto.isActive ?? existing.isActive;
    await this.validateRuleAttributeGroup(finalAttributeGroupId, finalIsActive);

    const rule = await this.prisma.recommendationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
        ...(Object.prototype.hasOwnProperty.call(dto, 'attributeGroupId')
          ? { attributeGroupId: dto.attributeGroupId ?? null }
          : {}),
        ...(dto.conditionType !== undefined
          ? { conditionType: dto.conditionType }
          : {}),
        ...(dto.scoreValue !== undefined ? { scoreValue: dto.scoreValue } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.adminRuleSelect(),
    });

    return this.toAdminRuleResponse(rule);
  }

  async adminDeactivateRule(id: string) {
    await this.ensureRuleExists(id);

    const rule = await this.prisma.recommendationRule.update({
      where: { id },
      data: { isActive: false },
      select: this.adminRuleSelect(),
    });

    return this.toAdminRuleResponse(rule);
  }

  private adminRuleSelect() {
    return {
      id: true,
      code: true,
      name: true,
      targetType: true,
      attributeGroupId: true,
      conditionType: true,
      scoreValue: true,
      weight: true,
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
    } satisfies Prisma.RecommendationRuleSelect;
  }

  private toAdminRuleResponse(rule: any) {
    const weight = toMoneyNumber(rule.weight) ?? 1;
    return {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      targetType: rule.targetType as RecommendationTargetType,
      attributeGroupId: rule.attributeGroupId,
      conditionType: rule.conditionType as RecommendationConditionType,
      scoreValue: rule.scoreValue,
      weight,
      effectiveScore: rule.scoreValue * weight,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      attributeGroup: rule.attributeGroup,
    };
  }

  private async ensureUniqueRuleCode(code: string) {
    const existing = await this.prisma.recommendationRule.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Recommendation rule code ${code} already exists.`,
      );
    }
  }

  private async ensureRuleExists(id: string) {
    const rule = await this.prisma.recommendationRule.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!rule) {
      throw new NotFoundException(`Recommendation rule ${id} was not found.`);
    }
  }

  private async validateRuleAttributeGroup(
    attributeGroupId: string | null | undefined,
    ruleIsActive: boolean,
  ) {
    if (!attributeGroupId) {
      return;
    }

    const group = await this.prisma.attributeGroup.findUnique({
      where: { id: attributeGroupId },
      select: { id: true, isActive: true },
    });

    if (!group) {
      throw new NotFoundException(
        `Attribute group ${attributeGroupId} was not found.`,
      );
    }

    if (ruleIsActive && !group.isActive) {
      throw new BadRequestException(
        'Active recommendation rule cannot reference an inactive attribute group.',
      );
    }
  }
}
