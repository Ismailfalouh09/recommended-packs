import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminRole,
  MatchType,
  MediaAssetProvider,
  MediaAssetType,
  MediaRole,
  OrderStatus,
  PackExperienceLevel,
  PackOccasion,
  PackStatus,
  PackTier,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  ProductStatus,
  RecommendationConditionType,
  RecommendationStatus,
  RecommendationTargetType,
  SelectionMode,
  SelectionType,
  SourceChannel,
  VariationType,
} from '@prisma/client';

const uuidExample = '00000000-0000-4000-8000-000000000001';

export class ApiErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['attributeGroupCode must not be empty'],
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}

export class PaginatedResponseMetadata {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  totalItems!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export class AdminSummaryResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Admin User' })
  fullName!: string;

  @ApiProperty({ example: 'admin@example.com' })
  email!: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.ADMIN })
  role!: AdminRole;
}

export class AuthLoginResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '1d' })
  expiresIn!: string;

  @ApiProperty({ type: AdminSummaryResponse })
  admin!: AdminSummaryResponse;
}

export class CurrentAdminResponse extends AdminSummaryResponse {
  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AttributeOptionResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'MEDIUM' })
  code!: string;

  @ApiProperty({ example: 'Medium' })
  label!: string;

  @ApiPropertyOptional({ example: 150, nullable: true })
  minNumericValue?: number | null;

  @ApiPropertyOptional({ example: 220, nullable: true })
  maxNumericValue?: number | null;
}

export class AttributeGroupResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'SKIN_COLOR' })
  code!: string;

  @ApiProperty({ example: 'Skin Color' })
  name!: string;

  @ApiProperty({ type: [AttributeOptionResponse] })
  options!: AttributeOptionResponse[];
}

export class QuizAttributeGroupResponse {
  @ApiProperty({ example: 'SKIN_COLOR' })
  code!: string;

  @ApiProperty({ example: 'Skin Color' })
  name!: string;
}

export class QuizQuestionOptionResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: uuidExample })
  attributeOptionId!: string;

  @ApiProperty({ example: 'MEDIUM' })
  code!: string;

  @ApiProperty({ example: 'Medium' })
  label!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  displayLabel?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  displayImageUrl?: string | null;
}

export class QuizQuestionResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'What is your skin color?' })
  questionText!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  helperText?: string | null;

  @ApiProperty({ enum: SelectionType, example: SelectionType.SINGLE })
  selectionType!: SelectionType;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: 1 })
  stepOrder!: number;

  @ApiProperty({ type: QuizAttributeGroupResponse })
  attributeGroup!: QuizAttributeGroupResponse;

  @ApiProperty({ type: [QuizQuestionOptionResponse] })
  options!: QuizQuestionOptionResponse[];
}

export class CustomerProfileAnswerResponse {
  @ApiProperty({ example: 'SKIN_COLOR' })
  attributeGroupCode!: string;

  @ApiProperty({ example: 'MEDIUM' })
  attributeOptionCode!: string;
}

export class CustomerProfileResponse {
  @ApiProperty({ example: uuidExample })
  customerProfileId!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000002' })
  sessionToken!: string;

  @ApiProperty({ enum: SourceChannel, example: SourceChannel.INSTAGRAM })
  sourceChannel!: SourceChannel;

  @ApiProperty({ type: [CustomerProfileAnswerResponse] })
  answers!: CustomerProfileAnswerResponse[];
}

export class CategorySummaryResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'FOUNDATION' })
  code!: string;

  @ApiProperty({ example: 'Foundation' })
  name!: string;

  @ApiPropertyOptional({ type: () => MediaImageResponse, nullable: true })
  image?: MediaImageResponse | null;
}

export class PublicCategoryImageResponse {
  @ApiProperty({ type: () => MediaUrlVariantsResponse })
  urls!: Record<string, string>;

  @ApiPropertyOptional({ example: 'Foundation category tile', nullable: true })
  altText?: string | null;
}

export class PublicCategoryResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'FOUNDATION' })
  code!: string;

  @ApiProperty({ example: 'Foundation' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Complexion products for a smooth base.',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: () => PublicCategoryImageResponse,
    nullable: true,
  })
  image?: PublicCategoryImageResponse | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  sortOrder?: number | null;

  @ApiPropertyOptional({ example: 12 })
  productCount?: number;

  @ApiPropertyOptional({ example: 3 })
  childCategoryCount?: number;
}

export class BrandSummaryResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Demo Beauty' })
  name!: string;
}

export class PublicBrandResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Demo Beauty' })
  name!: string;

  @ApiPropertyOptional({ example: 'Clean beauty essentials.', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/demo-beauty-logo.png',
    nullable: true,
    description:
      'Returned only when the existing brand logoUrl field has a value.',
  })
  logoUrl?: string | null;

  @ApiPropertyOptional({
    example: 8,
    description: 'Count of active products with status ACTIVE for this brand.',
  })
  productCount?: number;
}

export class AttributeMatchResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ enum: MatchType, example: MatchType.COMPATIBLE })
  matchType!: MatchType;

  @ApiProperty({ example: 40 })
  scoreValue!: number;

  @ApiProperty({ example: false })
  isHardFilter!: boolean;

  @ApiProperty({ type: QuizAttributeGroupResponse })
  attributeGroup!: QuizAttributeGroupResponse;

  @ApiProperty({ type: AttributeOptionResponse })
  attributeOption!: AttributeOptionResponse;
}

export class MediaUrlVariantsResponse {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/beauty-app/products/sample-image',
  })
  original!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_200,h_200,g_auto,q_auto,f_auto/beauty-app/products/sample-image',
  })
  thumbnail!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_600,h_600,g_auto,q_auto,f_auto/beauty-app/products/sample-image',
  })
  card!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,h_1200,q_auto,f_auto/beauty-app/products/sample-image',
  })
  detail!: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_300,h_300,q_auto,f_auto/beauty-app/product-references/sample-swatch',
  })
  swatch?: string;
}

export class MediaImageResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000002' })
  mediaAssetId!: string;

  @ApiProperty({ enum: MediaRole, example: MediaRole.COVER })
  role!: MediaRole;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiPropertyOptional({
    example: 'Foundation bottle shade medium warm',
    nullable: true,
  })
  altText?: string | null;

  @ApiPropertyOptional({ example: 'webp', nullable: true })
  format?: string | null;

  @ApiPropertyOptional({ example: 'image/webp', nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  height?: number | null;

  @ApiPropertyOptional({ example: 143000, nullable: true })
  bytes?: number | null;

  @ApiProperty({ type: MediaUrlVariantsResponse })
  urls!: MediaUrlVariantsResponse;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  updatedAt!: string;
}

export class PublicMediaImageResponse {
  @ApiProperty({ enum: MediaRole, example: MediaRole.COVER })
  role!: MediaRole;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiPropertyOptional({
    example: 'Foundation bottle shade medium warm',
    nullable: true,
  })
  altText?: string | null;

  @ApiPropertyOptional({ example: 'webp', nullable: true })
  format?: string | null;

  @ApiPropertyOptional({ example: 'image/webp', nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  height?: number | null;

  @ApiProperty({ type: MediaUrlVariantsResponse })
  urls!: MediaUrlVariantsResponse;
}

export class PublicProductAvailabilityResponse {
  @ApiProperty({ example: true })
  inStock!: boolean;

  @ApiPropertyOptional({ example: false })
  lowStock?: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  disabledReason?: string | null;
}

export class PublicProductPriceResponse {
  @ApiProperty({ example: 120 })
  current!: number;

  @ApiPropertyOptional({ example: 150, nullable: true })
  original?: number | null;

  @ApiProperty({ example: true })
  onSale!: boolean;

  @ApiProperty({ example: 'MAD' })
  currency!: string;
}

export class PublicProductVariantResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Medium Warm' })
  label!: string;

  @ApiProperty({ example: 'Medium Warm' })
  name!: string;

  @ApiPropertyOptional({ example: 'FOUNDATION-X-RF2', nullable: true })
  sku?: string | null;

  @ApiPropertyOptional({ example: 'Medium Warm', nullable: true })
  shadeName?: string | null;

  @ApiPropertyOptional({ example: 'N20', nullable: true })
  shadeCode?: string | null;

  @ApiPropertyOptional({ example: '30ml', nullable: true })
  measurement?: string | null;

  @ApiPropertyOptional({ example: '#E8B98C', nullable: true })
  swatchHex?: string | null;

  @ApiPropertyOptional({ type: () => PublicMediaImageResponse, nullable: true })
  image?: PublicMediaImageResponse | null;

  @ApiProperty({ type: PublicProductPriceResponse })
  price!: PublicProductPriceResponse;

  @ApiProperty({ type: PublicProductAvailabilityResponse })
  availability!: PublicProductAvailabilityResponse;
}

export class PublicProductCardResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'foundation-x' })
  slug!: string;

  @ApiProperty({ example: 'Foundation X' })
  name!: string;

  @ApiPropertyOptional({ type: BrandSummaryResponse, nullable: true })
  brand?: BrandSummaryResponse | null;

  @ApiProperty({ type: CategorySummaryResponse })
  category!: CategorySummaryResponse;

  @ApiPropertyOptional({ example: 'face-serum', nullable: true })
  productType?: string | null;

  @ApiPropertyOptional({ type: () => PublicMediaImageResponse, nullable: true })
  coverImage?: PublicMediaImageResponse | null;

  @ApiProperty({ example: 120 })
  currentPrice!: number;

  @ApiProperty({ example: 120 })
  priceFrom!: number;

  @ApiPropertyOptional({ example: 150, nullable: true })
  originalPrice?: number | null;

  @ApiProperty({ example: true })
  onSale!: boolean;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ type: PublicProductAvailabilityResponse })
  availability!: PublicProductAvailabilityResponse;
}

export class ProductReferenceResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'RF2' })
  referenceCode!: string;

  @ApiProperty({ example: 'Medium Warm' })
  referenceName!: string;

  @ApiPropertyOptional({ example: 'Medium Warm', nullable: true })
  shadeName?: string | null;

  @ApiPropertyOptional({ example: 'N20', nullable: true })
  shadeCode?: string | null;

  @ApiPropertyOptional({ example: '#E8B98C', nullable: true })
  swatchHex?: string | null;

  @ApiPropertyOptional({ example: '45ml', nullable: true })
  measurement?: string | null;

  @ApiPropertyOptional({ enum: VariationType, nullable: true })
  variationType?: VariationType | null;

  @ApiPropertyOptional({ example: 'FOUNDATION-X-RF2', nullable: true })
  sku?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  barcode?: string | null;

  @ApiProperty({ example: 0 })
  priceDelta!: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Effective unit price (priceOverride or basePrice + delta).',
  })
  effectivePrice?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Derived public stock signal (exact count hidden).',
  })
  inStock?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Low-stock badge derived from the reference threshold.',
  })
  lowStock?: boolean;

  @ApiPropertyOptional({
    example: 20,
    description: 'Exact stock count (admin projection only).',
  })
  stockQuantity?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Reserved stock (admin projection only).',
  })
  reservedQuantity?: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ type: () => MediaImageResponse, nullable: true })
  image?: MediaImageResponse | null;

  @ApiProperty({ type: [AttributeMatchResponse] })
  attributes!: AttributeMatchResponse[];
}

export class ProductResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Foundation X' })
  name!: string;

  @ApiProperty({ example: 'foundation-x' })
  slug!: string;

  @ApiPropertyOptional({ example: 'face-serum', nullable: true })
  productType?: string | null;

  @ApiPropertyOptional({
    example: 'Lightweight buildable foundation.',
    nullable: true,
  })
  shortDescription?: string | null;

  @ApiPropertyOptional({
    example: 'Aqua, Glycerin, Niacinamide.',
    nullable: true,
  })
  ingredients?: string | null;

  @ApiPropertyOptional({
    example: 'Apply morning and evening.',
    nullable: true,
  })
  directions?: string | null;

  @ApiProperty({ example: 120 })
  basePrice!: number;

  @ApiPropertyOptional({ example: 150, nullable: true })
  compareAtPrice?: number | null;

  @ApiPropertyOptional({
    example: 120,
    description: 'Lowest effective reference price.',
  })
  priceFrom?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Derived from compareAtPrice.',
  })
  onSale?: boolean;

  @ApiPropertyOptional({
    example: 20,
    description: 'Derived % saving when on sale.',
  })
  percentageSaving?: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiPropertyOptional({
    example: 'Foundation X | Demo Beauty',
    nullable: true,
  })
  metaTitle?: string | null;

  @ApiPropertyOptional({ example: 'Shop Foundation X.', nullable: true })
  metaDescription?: string | null;

  @ApiPropertyOptional({
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
    description: 'Admin projection only; omitted from the public contract.',
  })
  status?: ProductStatus;

  @ApiProperty({ type: CategorySummaryResponse })
  category!: CategorySummaryResponse;

  @ApiPropertyOptional({ type: BrandSummaryResponse, nullable: true })
  brand?: BrandSummaryResponse | null;

  @ApiProperty({ type: [ProductReferenceResponse] })
  references!: ProductReferenceResponse[];

  @ApiPropertyOptional({ type: () => MediaImageResponse, nullable: true })
  coverImage?: MediaImageResponse | null;

  @ApiProperty({ type: [MediaImageResponse] })
  images!: MediaImageResponse[];
}

export class ShareMetadataResponse {
  @ApiProperty({
    example: '/products/foundation-x',
    description:
      'Canonical public share URL. Absolute when STORE_FRONTEND_ORIGIN is ' +
      'configured; otherwise the canonical relative path.',
  })
  shareUrl!: string;

  @ApiProperty({ example: 'Foundation X' })
  shareTitle!: string;

  @ApiPropertyOptional({
    example: 'Lightweight buildable foundation.',
    nullable: true,
  })
  shareDescription?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/foundation-x.jpg',
    nullable: true,
  })
  shareImageUrl?: string | null;
}

export class PublicProductDetailResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'foundation-x' })
  slug!: string;

  @ApiProperty({ example: 'Foundation X' })
  name!: string;

  @ApiPropertyOptional({ example: 'face-serum', nullable: true })
  productType?: string | null;

  @ApiPropertyOptional({
    example: 'Lightweight buildable foundation.',
    nullable: true,
  })
  shortDescription?: string | null;

  @ApiPropertyOptional({ example: 'Demo foundation', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'Aqua, Glycerin, Niacinamide.',
    nullable: true,
  })
  ingredients?: string | null;

  @ApiPropertyOptional({
    example: 'Apply morning and evening.',
    nullable: true,
  })
  directions?: string | null;

  @ApiProperty({ example: 120 })
  currentPrice!: number;

  @ApiPropertyOptional({ example: 150, nullable: true })
  originalPrice?: number | null;

  @ApiProperty({ example: 120 })
  priceFrom!: number;

  @ApiProperty({ example: true })
  onSale!: boolean;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ type: CategorySummaryResponse })
  category!: CategorySummaryResponse;

  @ApiPropertyOptional({ type: BrandSummaryResponse, nullable: true })
  brand?: BrandSummaryResponse | null;

  @ApiPropertyOptional({
    type: () => PublicProductVariantResponse,
    nullable: true,
  })
  selectedReference?: PublicProductVariantResponse | null;

  @ApiProperty({ type: [PublicProductVariantResponse] })
  selectableReferences!: PublicProductVariantResponse[];

  @ApiProperty({
    example: {
      requiresReference: true,
      selectedReferenceId: uuidExample,
      canAdd: true,
      disabledReason: null,
    },
  })
  addToCart!: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => PublicMediaImageResponse, nullable: true })
  coverImage?: PublicMediaImageResponse | null;

  @ApiProperty({ type: [PublicMediaImageResponse] })
  mediaGallery!: PublicMediaImageResponse[];

  // Phase 8B — storefront-safe share metadata for the active public product.
  @ApiProperty({ type: ShareMetadataResponse })
  share!: ShareMetadataResponse;
}

export class PackItemResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({
    enum: SelectionMode,
    example: SelectionMode.AUTO_BEST_REFERENCE,
  })
  selectionMode!: SelectionMode;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ type: ProductResponse })
  product!: ProductResponse;

  @ApiPropertyOptional({ type: ProductReferenceResponse, nullable: true })
  productReference?: ProductReferenceResponse | null;
}

export class PackResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Natural Glow Pack' })
  name!: string;

  @ApiProperty({ example: 'natural-glow-pack' })
  slug!: string;

  @ApiProperty({ enum: PriceMode, example: PriceMode.FIXED })
  priceMode!: PriceMode;

  @ApiPropertyOptional({ example: 299, nullable: true })
  fixedPrice?: number | null;

  @ApiProperty({ enum: PackStatus, example: PackStatus.ACTIVE })
  status!: PackStatus;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: [AttributeMatchResponse] })
  attributes!: AttributeMatchResponse[];

  @ApiProperty({ type: [PackItemResponse] })
  items!: PackItemResponse[];

  @ApiPropertyOptional({ type: () => MediaImageResponse, nullable: true })
  coverImage?: MediaImageResponse | null;

  @ApiProperty({ type: [MediaImageResponse] })
  images!: MediaImageResponse[];

  // Pack Core Evolution (Phase 4A) — public discovery fields. Present on the
  // filtered/paginated catalog response; omitted on the legacy no-filter array.
  @ApiPropertyOptional({
    type: () => CategorySummaryResponse,
    nullable: true,
    description: 'Reused shared Category the Pack is filed under, if any.',
  })
  category?: CategorySummaryResponse | null;

  @ApiPropertyOptional({ enum: PackTier, nullable: true })
  tier?: PackTier | null;

  @ApiPropertyOptional({ enum: PackOccasion, nullable: true })
  occasion?: PackOccasion | null;

  @ApiPropertyOptional({ enum: PackExperienceLevel, nullable: true })
  experienceLevel?: PackExperienceLevel | null;

  @ApiPropertyOptional({ example: true })
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: false })
  isNew?: boolean;

  @ApiPropertyOptional({ example: false })
  isBestSeller?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['bridal', 'glam'] })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'wedding bridal soft glam',
    nullable: true,
  })
  searchKeywords?: string | null;

  @ApiPropertyOptional({
    example: true,
    description:
      'Browsing availability: true when every FIXED/REQUIRED_SELECTABLE item has an active reference with enough available stock. Present only on the filtered catalog response.',
  })
  availableNow?: boolean;

  // Phase 8B — storefront-safe share metadata for the active public pack.
  @ApiPropertyOptional({ type: ShareMetadataResponse })
  share?: ShareMetadataResponse;
}

export class NormalizedConfigurationItemResponse {
  @ApiPropertyOptional({
    example: uuidExample,
    nullable: true,
    description: 'Source PackItem id for base items; null for add-ons.',
  })
  packItemId?: string | null;

  @ApiProperty({ example: uuidExample })
  productId!: string;

  @ApiPropertyOptional({ example: uuidExample, nullable: true })
  productReferenceId?: string | null;

  @ApiProperty({
    example: 'REQUIRED_SELECTABLE',
    description: 'PackItemRole for base items, or "ADD_ON" for add-ons.',
  })
  role!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 120 })
  unitPrice!: number;

  @ApiProperty({ example: 120 })
  lineTotal!: number;

  @ApiProperty({ example: false })
  isAddOn!: boolean;

  @ApiProperty({ example: false })
  removed!: boolean;
}

export class ConfigurationValidationErrorResponse {
  @ApiProperty({ example: 'REFERENCE_NOT_ALLOWED' })
  code!: string;

  @ApiProperty({ example: 'The chosen reference is not allowed for Foundation X.' })
  message!: string;

  @ApiPropertyOptional({ example: uuidExample, nullable: true })
  packItemId?: string;

  @ApiPropertyOptional({ example: uuidExample, nullable: true })
  productId?: string;
}

export class PackConfigurationValidationResponse {
  @ApiProperty({
    example: true,
    description: 'True only when no validation error was recorded.',
  })
  isValid!: boolean;

  @ApiProperty({
    example: 349,
    description:
      'Server-recomputed price from the current allowed references. Never taken from the client.',
  })
  computedPrice!: number;

  @ApiPropertyOptional({
    example: 300,
    nullable: true,
    description: 'The Pack price floor, if configured.',
  })
  minAllowedPrice?: number | null;

  @ApiProperty({
    enum: ['IN_STOCK', 'OUT_OF_STOCK'],
    example: 'IN_STOCK',
    description:
      'Aggregate stock status across all resolved references in the configuration.',
  })
  stockStatus!: 'IN_STOCK' | 'OUT_OF_STOCK';

  @ApiProperty({ type: [NormalizedConfigurationItemResponse] })
  normalizedItems!: NormalizedConfigurationItemResponse[];

  @ApiProperty({ type: [ConfigurationValidationErrorResponse] })
  validationErrors!: ConfigurationValidationErrorResponse[];
}

export class PackConfigurationItemLineResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiPropertyOptional({
    example: uuidExample,
    nullable: true,
    description: 'Source PackItem id for base items; null for add-ons.',
  })
  packItemId?: string | null;

  @ApiProperty({ example: uuidExample })
  productId!: string;

  @ApiPropertyOptional({ example: uuidExample, nullable: true })
  productReferenceId?: string | null;

  @ApiProperty({
    example: 'REQUIRED_SELECTABLE',
    description: 'PackItemRole for base items, or "ADD_ON" for add-ons.',
  })
  role!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 120 })
  unitPrice!: number;

  @ApiProperty({ example: 120 })
  lineTotal!: number;

  @ApiProperty({ example: false })
  isAddOn!: boolean;

  @ApiProperty({ example: false })
  removed!: boolean;
}

export class PackConfigurationResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: uuidExample })
  sourcePackId!: string;

  @ApiProperty({ example: 'CUSTOMIZED' })
  sourceType!: string;

  @ApiProperty({
    example: 349,
    description: 'Server-recomputed final price. Never a client-supplied price.',
  })
  finalPrice!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiPropertyOptional({ example: 300, nullable: true })
  minAllowedPrice?: number | null;

  @ApiProperty({ example: true })
  isValid!: boolean;

  @ApiProperty({ enum: ['IN_STOCK', 'OUT_OF_STOCK'], example: 'IN_STOCK' })
  stockStatus!: string;

  @ApiProperty({
    type: PackConfigurationValidationResponse,
    description: 'Immutable validator result frozen at persistence time.',
  })
  validationResult!: PackConfigurationValidationResponse;

  @ApiProperty({ type: [PackConfigurationItemLineResponse] })
  items!: PackConfigurationItemLineResponse[];

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  updatedAt!: string;
}

export class ConfigurationShareResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({
    example: 'a3f1c2b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7081920a1b2c3d4e5f6',
    description: 'Opaque, unique public share token for the configuration.',
  })
  shareToken!: string;

  @ApiProperty({
    example: '/shared/configurations/a3f1c2b4d5e6f7081920a1b2c3d4e5f6',
    description:
      'Public share link resolving the read-only shared configuration view. ' +
      'Absolute when STORE_FRONTEND_ORIGIN is configured; otherwise relative.',
  })
  shareUrl!: string;
}

export class SharedConfigurationSourcePackResponse {
  @ApiPropertyOptional({ example: 'Natural Glow Pack', nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ example: 'natural-glow-pack', nullable: true })
  slug?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/natural-glow.jpg',
    nullable: true,
  })
  imageUrl?: string | null;
}

export class SharedConfigurationItemResponse {
  @ApiProperty({ example: uuidExample })
  productId!: string;

  @ApiPropertyOptional({ example: 'Foundation X', nullable: true })
  productName?: string | null;

  @ApiPropertyOptional({ example: 'foundation-x', nullable: true })
  productSlug?: string | null;

  @ApiPropertyOptional({ example: uuidExample, nullable: true })
  productReferenceId?: string | null;

  @ApiPropertyOptional({ example: 'RF2 Medium Warm', nullable: true })
  referenceName?: string | null;

  @ApiPropertyOptional({ example: 'Medium Warm', nullable: true })
  shadeName?: string | null;

  @ApiPropertyOptional({ example: 'RF2', nullable: true })
  shadeCode?: string | null;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({
    example: 120,
    description: 'Customer-facing displayed line price (selling price).',
  })
  lineTotal!: number;

  @ApiProperty({ example: false })
  isAddOn!: boolean;
}

export class SharedPackConfigurationResponse {
  @ApiProperty({ type: SharedConfigurationSourcePackResponse })
  sourcePack!: SharedConfigurationSourcePackResponse;

  @ApiProperty({ type: [SharedConfigurationItemResponse] })
  items!: SharedConfigurationItemResponse[];

  @ApiProperty({
    example: 349,
    description: 'Final displayed price (server-recomputed; never client-set).',
  })
  finalPrice!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: ShareMetadataResponse })
  share!: ShareMetadataResponse;
}

export class SelectableReferenceOptionResponse {
  @ApiProperty({ example: uuidExample })
  referenceId!: string;

  @ApiProperty({ example: 'RF2 Medium Warm' })
  referenceName!: string;

  @ApiPropertyOptional({ type: () => MediaImageResponse, nullable: true })
  referenceImage?: MediaImageResponse | null;

  @ApiProperty({ example: 1 })
  quantity!: number;
}

export class RecommendationResultItemResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 65 })
  itemScore!: number;

  @ApiProperty({ type: ProductResponse })
  product!: ProductResponse;

  @ApiPropertyOptional({ type: ProductReferenceResponse, nullable: true })
  selectedProductReference?: ProductReferenceResponse | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'True when this is a required customer-choice slot that is eligible but awaiting the customer’s final reference selection. The engine does not pick a reference for such a slot.',
  })
  selectionRequired?: boolean;

  @ApiPropertyOptional({
    type: [SelectableReferenceOptionResponse],
    description:
      'Valid, compatible, in-stock references the customer may choose from when selectionRequired is true.',
  })
  availableOptions?: SelectableReferenceOptionResponse[];
}

export class RecommendationPackResponse {
  @ApiProperty({ example: uuidExample })
  recommendationResultId!: string;

  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ example: 83 })
  totalScore!: number;

  @ApiProperty({ example: 83 })
  matchPercentage!: number;

  @ApiProperty({ example: 'Strong match for your selected profile.' })
  reasonSummary!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Matches your makeup style', 'Fits your selected budget'],
  })
  customerReasons?: string[];

  @ApiPropertyOptional({
    enum: ['BEST_MATCH', 'ALTERNATIVE'],
    example: 'BEST_MATCH',
  })
  recommendationType?: 'BEST_MATCH' | 'ALTERNATIVE';

  @ApiProperty({ type: PackResponse })
  pack!: PackResponse;

  @ApiProperty({ type: [RecommendationResultItemResponse] })
  items!: RecommendationResultItemResponse[];

  @ApiProperty({
    example: {
      packScore: 30,
      rawItemsScore: 145,
      normalizedItemsScore: 48,
      priorityBonus: 5,
    },
  })
  reasonJson!: Record<string, unknown>;
}

export class RecommendationResponse {
  @ApiProperty({ example: uuidExample })
  sessionId!: string;

  @ApiProperty({
    enum: RecommendationStatus,
    example: RecommendationStatus.COMPLETED,
  })
  status!: RecommendationStatus;

  @ApiProperty({ example: 'v1' })
  algorithmVersion!: string;

  @ApiProperty({ type: [RecommendationPackResponse] })
  recommendedPacks!: RecommendationPackResponse[];
}

export class PublicOrderResponse {
  @ApiProperty({ example: uuidExample })
  orderId!: string;

  @ApiProperty({ example: 'ORD-20260612-0001' })
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING_CONFIRMATION })
  orderStatus!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ example: 299 })
  totalAmount!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ example: 'Natural Glow Pack' })
  packName!: string;

  @ApiProperty({ example: '2026-06-12T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-12T10:00:00.000Z' })
  updatedAt!: string;
}

export class OrderItemResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Foundation X' })
  productNameSnapshot!: string;

  @ApiProperty({ example: 'Medium Warm' })
  referenceNameSnapshot!: string;

  @ApiPropertyOptional({ example: 'FOUNDATION-X-RF2', nullable: true })
  skuSnapshot?: string | null;

  @ApiPropertyOptional({ example: 'Medium Warm', nullable: true })
  variationSnapshot?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/product.jpg',
    nullable: true,
  })
  productImageUrlSnapshot?: string | null;

  @ApiPropertyOptional({ example: 'Demo Beauty', nullable: true })
  brandNameSnapshot?: string | null;

  @ApiProperty({ example: 120 })
  unitPriceSnapshot!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 120 })
  totalPrice!: number;
}

export class OrderCreateResponse extends PublicOrderResponse {
  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];
}

export class CartOrderCustomerResponse {
  @ApiProperty({ example: 'Demo Customer' })
  fullName!: string;

  @ApiProperty({ example: '0600000000' })
  phone!: string;
}

export class CartOrderAddressResponse {
  @ApiProperty({ example: 'Casablanca' })
  city!: string;

  @ApiProperty({ example: 'Maarif' })
  addressLine!: string;
}

export class CartOrderLineResponse {
  @ApiProperty({ example: uuidExample })
  productId!: string;

  @ApiProperty({ example: 'Foundation X' })
  productName!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000002' })
  referenceId!: string;

  @ApiProperty({ example: 'RF2 Medium Warm' })
  referenceName!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 120 })
  unitPrice!: number;

  @ApiProperty({ example: 120 })
  totalPrice!: number;
}

export class CartOrderCreateResponse {
  @ApiProperty({ example: uuidExample })
  orderId!: string;

  @ApiProperty({ example: 'ORD-20260612-0001' })
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING_CONFIRMATION })
  orderStatus!: OrderStatus;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH_ON_DELIVERY,
  })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ example: 120 })
  subtotalAmount!: number;

  @ApiProperty({ example: 0 })
  discountAmount!: number;

  @ApiProperty({ example: 0 })
  deliveryFee!: number;

  @ApiProperty({ example: 120 })
  totalAmount!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ type: CartOrderCustomerResponse })
  customer!: CartOrderCustomerResponse;

  @ApiProperty({ type: CartOrderAddressResponse })
  address!: CartOrderAddressResponse;

  @ApiProperty({ type: Object, nullable: true, example: null })
  pack!: null;

  @ApiProperty({ type: [CartOrderLineResponse] })
  items!: CartOrderLineResponse[];
}

export class AdminOrderCustomerResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Demo Customer' })
  fullName!: string;

  @ApiProperty({ example: '0600000000' })
  phone!: string;

  @ApiPropertyOptional({ example: '0600000000', nullable: true })
  whatsappPhone?: string | null;
}

export class AdminOrderAddressResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'Casablanca' })
  city!: string;

  @ApiProperty({ example: 'Maarif' })
  addressLine!: string;

  @ApiPropertyOptional({ example: 'Near the pharmacy', nullable: true })
  extraInfo?: string | null;
}

export class AdminOrderStatusHistoryResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiPropertyOptional({ enum: OrderStatus, nullable: true })
  oldStatus?: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  newStatus!: OrderStatus;

  @ApiPropertyOptional({
    example: 'Customer confirmed by phone',
    nullable: true,
  })
  comment?: string | null;

  @ApiPropertyOptional({ type: AdminSummaryResponse, nullable: true })
  changedByAdmin?: AdminSummaryResponse | null;

  @ApiProperty({ example: '2026-06-12T10:00:00.000Z' })
  createdAt!: string;
}

export class AdminOrderDetailsResponse extends PublicOrderResponse {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH_ON_DELIVERY })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ type: AdminOrderCustomerResponse })
  customer!: AdminOrderCustomerResponse;

  @ApiProperty({ type: AdminOrderAddressResponse })
  customerAddress!: AdminOrderAddressResponse;

  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];

  @ApiProperty({ type: [AdminOrderStatusHistoryResponse] })
  statusHistory!: AdminOrderStatusHistoryResponse[];
}

export class AdminCategoryResponse extends CategorySummaryResponse {
  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AdminBrandResponse extends BrandSummaryResponse {
  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class RecommendationRuleResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'SKIN_COLOR_MATCH' })
  code!: string;

  @ApiProperty({ example: 'Skin color match' })
  name!: string;

  @ApiProperty({ enum: RecommendationTargetType })
  targetType!: RecommendationTargetType;

  @ApiProperty({ enum: RecommendationConditionType })
  conditionType!: RecommendationConditionType;

  @ApiProperty({ example: 40 })
  scoreValue!: number;

  @ApiProperty({ example: 1 })
  weight!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class MediaAssetResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({
    enum: MediaAssetProvider,
    example: MediaAssetProvider.CLOUDINARY,
  })
  provider!: MediaAssetProvider;

  @ApiProperty({ enum: MediaAssetType, example: MediaAssetType.IMAGE })
  assetType!: MediaAssetType;

  @ApiProperty({ example: 'recommended-packs/products/sample-image' })
  publicId!: string;

  @ApiPropertyOptional({ example: '1234567890abcdef', nullable: true })
  providerAssetId?: string | null;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/recommended-packs/products/sample-image.jpg',
  })
  secureUrl!: string;

  @ApiPropertyOptional({
    example: 'recommended-packs/products',
    nullable: true,
  })
  folder?: string | null;

  @ApiProperty({ example: 'image' })
  resourceType!: string;

  @ApiPropertyOptional({ example: 'foundation.jpg', nullable: true })
  originalName?: string | null;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @ApiPropertyOptional({ example: 'jpg', nullable: true })
  format?: string | null;

  @ApiPropertyOptional({ example: '1718292000', nullable: true })
  version?: string | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ example: 1200, nullable: true })
  height?: number | null;

  @ApiProperty({ example: 245000 })
  bytes!: number;

  @ApiPropertyOptional({
    example: 'Foundation bottle shade medium warm',
    nullable: true,
  })
  altText?: string | null;

  @ApiPropertyOptional({ example: 'PRODUCT_MAIN_IMAGE', nullable: true })
  usageContext?: string | null;

  @ApiPropertyOptional({ example: 'PRODUCT', nullable: true })
  relatedEntity?: string | null;

  @ApiPropertyOptional({
    example: '00000000-0000-4000-8000-000000000002',
    nullable: true,
  })
  relatedEntityId?: string | null;

  @ApiPropertyOptional({ type: AdminSummaryResponse, nullable: true })
  uploadedByAdmin?: AdminSummaryResponse | null;

  @ApiProperty({ type: MediaUrlVariantsResponse })
  urls!: MediaUrlVariantsResponse;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt?: string | null;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-13T10:00:00.000Z' })
  updatedAt!: string;
}
