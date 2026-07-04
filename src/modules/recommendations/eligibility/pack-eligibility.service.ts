import { Injectable } from '@nestjs/common';
import {
  EnginePack,
  EngineRecommendation,
  RecommendationEngineService,
  RuleScores,
} from '../recommendation-engine.service';

type AnswerMap = Record<string, string>;

/**
 * Pack Recommendation MVP — decides which Packs can be CONSIDERED at all.
 *
 * Eligibility is intentionally delegated to the existing recommendation engine,
 * which already encodes the safe, Phase-1 behavior this MVP must preserve exactly:
 *   - Pack active/recommendable state,
 *   - required fixed-item availability,
 *   - required CUSTOMER_CHOICE availability (a Pack with a customer-choice slot
 *     stays eligible when >= 1 compatible active in-stock option exists, and the
 *     response keeps exposing `selectionRequired: true` + `availableOptions`),
 *   - at least one valid compatible in-stock option for required selectable items.
 *
 * It returns the eligible candidates with their resolved items and existing
 * response fields untouched. It does NOT score Packs on the five compatibility
 * criteria — that is the matching/scoring layer's job.
 */
@Injectable()
export class PackEligibilityService {
  constructor(private readonly engine: RecommendationEngineService) {}

  getEligibleCandidates(input: {
    answers: AnswerMap;
    packs: EnginePack[];
    ruleScores: RuleScores;
  }): EngineRecommendation[] {
    return this.engine.generateRecommendations(input);
  }
}
