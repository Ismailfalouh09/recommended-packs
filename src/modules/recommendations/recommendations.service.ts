import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
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
import { MediaUrlService } from '../media/media-url.service';
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
import { BudgetRange } from './matching/criterion-matcher.interface';
import { RecommendationUseCaseService } from './recommendation-use-case.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationEngine: RecommendationEngineService,
    // Pack Recommendation MVP — the five-criterion algorithm. Optional so the
    // existing admin-rule unit spec can construct the service without it; when
    // absent (only in that spec) we fall back to the raw engine output.
    private readonly recommendationUseCase?: RecommendationUseCaseService,
    private readonly mediaUrlService?: MediaUrlService,
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
            reasonSummary: this.buildReasonSummary(recommendation),
            reasonJson: this.toStoredReasonJson(recommendation),
          },
        });
        recommendationResultIds.set(recommendation.packId, result.id);

        await tx.recommendationResultItem.createMany({
          // Customer-choice slots that are still pending selection have no
          // concrete reference yet. `selectedProductReferenceId` is NOT NULL, so
          // we persist only items with a committed reference; pending slots are
          // surfaced in the runtime response only (no schema change required).
          data: recommendation.selectedItems
            .filter(
              (
                item,
              ): item is (typeof recommendation.selectedItems)[number] & {
                referenceId: string;
              } => !item.selectionRequired && item.referenceId !== null,
            )
            .map((item) => ({
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
    const budgetRangesByOptionCode = this.buildBudgetRangesByOptionCode(
      customerProfile.answers,
    );

    if (Object.keys(answers).length === 0) {
      throw new BadRequestException('Customer profile has no quiz answers.');
    }

    const [packs, ruleScores] = await Promise.all([
      this.loadActivePacks(),
      this.loadRuleScores(),
    ]);

    const recommendations = this.recommendationUseCase
      ? this.recommendationUseCase.recommend({
          answers,
          packs,
          ruleScores,
          budgetRangesByOptionCode,
        })
      : this.recommendationEngine.generateRecommendations({
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
                images: {
                  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                  select: {
                    id: true,
                    mediaId: true,
                    role: true,
                    position: true,
                    altText: true,
                    createdAt: true,
                    updatedAt: true,
                    media: true,
                  },
                },
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
                    images: {
                      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                      select: {
                        id: true,
                        mediaId: true,
                        role: true,
                        position: true,
                        altText: true,
                        createdAt: true,
                        updatedAt: true,
                        media: true,
                      },
                    },
                  },
                },
                selectedProductReference: {
                  select: {
                    referenceCode: true,
                    referenceName: true,
                    image: {
                      select: {
                        id: true,
                        mediaId: true,
                        role: true,
                        altText: true,
                        createdAt: true,
                        updatedAt: true,
                        media: true,
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
      recommendedPacks: session.results.map((result) => {
        const metadata = this.extractStoredRecommendationMetadata(
          result.reasonJson,
        );

        return {
          recommendationResultId: result.id,
          packId: result.packId,
          packName: result.pack.name,
          packCoverImage: this.coverImage(result.pack.images),
          packImages: result.pack.images.map((image) =>
            this.toImageResponse(image),
          ),
          rank: result.rank,
          totalScore: result.totalScore,
          matchPercentage: Number(result.matchPercentage),
          reasonSummary: result.reasonSummary,
          reason: this.toPublicReasonJson(result.reasonJson),
          customerReasons: metadata.customerReasons,
          recommendationType: metadata.recommendationType,
          selectedItems: result.items.map((item) => ({
            recommendationResultItemId: item.id,
            packItemId: item.packItemId,
            productId: item.productId,
            productName: item.product.name,
            productCoverImage: this.coverImage(item.product.images),
            referenceId: item.selectedProductReferenceId,
            referenceName: `${item.selectedProductReference.referenceCode} ${item.selectedProductReference.referenceName}`,
            referenceImage: this.toReferenceImageResponse(
              item.selectedProductReference.image,
            ),
            quantity: item.quantity,
            itemScore: item.itemScore,
            reason: item.reasonJson,
          })),
        };
      }),
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
                minNumericValue: true,
                maxNumericValue: true,
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

  private buildBudgetRangesByOptionCode(
    answers: Array<{
      attributeGroup: { code: string };
      attributeOption: {
        code: string;
        minNumericValue: Prisma.Decimal | null;
        maxNumericValue: Prisma.Decimal | null;
      } | null;
    }>,
  ): Record<string, BudgetRange> {
    return answers.reduce<Record<string, BudgetRange>>((ranges, answer) => {
      if (answer.attributeGroup.code !== 'BUDGET' || !answer.attributeOption) {
        return ranges;
      }

      const min = toMoneyNumber(answer.attributeOption.minNumericValue);
      const max = toMoneyNumber(answer.attributeOption.maxNumericValue);

      if (
        min === null ||
        max === null ||
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 0 ||
        max < min
      ) {
        return ranges;
      }

      ranges[answer.attributeOption.code] = { min, max };
      return ranges;
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
        // Pack Recommendation MVP — authoritative price + the compatibility
        // profile that drives the five-criterion matching layer.
        priceMode: true,
        fixedPrice: true,
        discountAmount: true,
        discountPercentage: true,
        compatibilityProfiles: {
          select: {
            criterion: true,
            mode: true,
            values: {
              select: {
                attributeOption: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
        images: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            mediaId: true,
            role: true,
            position: true,
            altText: true,
            createdAt: true,
            updatedAt: true,
            media: true,
          },
        },
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
                basePrice: true,
                isActive: true,
                status: true,
                images: {
                  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                  select: {
                    id: true,
                    mediaId: true,
                    role: true,
                    position: true,
                    altText: true,
                    createdAt: true,
                    updatedAt: true,
                    media: true,
                  },
                },
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
                    priceOverride: true,
                    priceDelta: true,
                    image: {
                      select: {
                        id: true,
                        mediaId: true,
                        role: true,
                        altText: true,
                        createdAt: true,
                        updatedAt: true,
                        media: true,
                      },
                    },
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
      packCoverImage: this.coverImage(recommendation.packImages ?? []),
      packImages: (recommendation.packImages ?? []).map((image) =>
        this.toImageResponse(image),
      ),
      rank: recommendation.rank,
      totalScore: recommendation.totalScore,
      matchPercentage: recommendation.matchPercentage,
      reason: this.toPublicReasonJson(recommendation.reason),
      customerReasons: recommendation.customerReasons ?? [],
      recommendationType: recommendation.recommendationType,
      selectedItems: recommendation.selectedItems.map((item) => ({
        packItemId: item.packItemId,
        productId: item.productId,
        productName: item.productName,
        productCoverImage: this.coverImage(item.productImages ?? []),
        referenceId: item.referenceId,
        referenceName: item.referenceName,
        referenceImage: this.toReferenceImageResponse(item.referenceImage),
        quantity: item.quantity,
        itemScore: item.itemScore,
        selectionRequired: item.selectionRequired ?? false,
        availableOptions: item.availableOptions
          ? item.availableOptions.map((option) => ({
              referenceId: option.referenceId,
              referenceName: option.referenceName,
              referenceImage: this.toReferenceImageResponse(
                option.referenceImage,
              ),
              quantity: option.quantity,
            }))
          : undefined,
        reason: item.reason,
      })),
    }));
  }

  private buildReasonSummary(recommendation: EngineRecommendation) {
    const label =
      recommendation.recommendationType === 'ALTERNATIVE'
        ? 'Alternative match'
        : 'Best match';
    const reasons = recommendation.customerReasons ?? [];

    if (reasons.length === 0) {
      return `${label} for your profile.`;
    }

    return `${label}: ${reasons.slice(0, 2).join('; ')}.`;
  }

  private toStoredReasonJson(
    recommendation: EngineRecommendation,
  ): Prisma.InputJsonValue {
    return {
      ...this.toPublicReasonJson(recommendation.reason),
      customerReasons: recommendation.customerReasons ?? [],
      recommendationType: recommendation.recommendationType ?? null,
    } as Prisma.InputJsonValue;
  }

  private toPublicReasonJson(reasonJson: unknown) {
    const reason =
      reasonJson && typeof reasonJson === 'object'
        ? { ...(reasonJson as Record<string, unknown>) }
        : {};

    delete reason.compatibility;
    delete reason.customerReasons;
    delete reason.recommendationType;

    return reason;
  }

  private extractStoredRecommendationMetadata(reasonJson: unknown): {
    customerReasons: string[];
    recommendationType?: 'BEST_MATCH' | 'ALTERNATIVE';
  } {
    const reason =
      reasonJson && typeof reasonJson === 'object'
        ? (reasonJson as Record<string, unknown>)
        : {};
    const recommendationType = reason.recommendationType;

    return {
      customerReasons: Array.isArray(reason.customerReasons)
        ? reason.customerReasons.filter(
            (customerReason): customerReason is string =>
              typeof customerReason === 'string',
          )
        : [],
      recommendationType:
        recommendationType === 'BEST_MATCH' ||
        recommendationType === 'ALTERNATIVE'
          ? recommendationType
          : undefined,
    };
  }

  private coverImage(images: unknown[]) {
    const typedImages = images as any[];
    const cover = typedImages.find((image) => image.role === MediaRole.COVER);
    return cover ? this.toImageResponse(cover) : null;
  }

  private toReferenceImageResponse(image: unknown) {
    if (!image) {
      return null;
    }

    return this.toImageResponse(
      {
        ...(image as any),
        role: MediaRole.SWATCH,
        position: 0,
      },
      true,
    );
  }

  private toImageResponse(image: any, includeSwatch = false) {
    return {
      id: image.id,
      mediaAssetId: image.mediaId,
      role: image.role,
      position: image.position,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      bytes: image.media.bytes,
      urls: this.mediaUrlService?.buildUrls(image.media, { includeSwatch }) ?? {
        original: image.media.secureUrl,
        thumbnail: image.media.secureUrl,
        card: image.media.secureUrl,
        detail: image.media.secureUrl,
        ...(includeSwatch ? { swatch: image.media.secureUrl } : {}),
      },
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
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
