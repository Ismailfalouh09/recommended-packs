import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminRole,
  MatchType,
  MediaAssetProvider,
  MediaAssetType,
  MediaRole,
  OrderStatus,
  PackStatus,
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

export class ProductReferenceResponse {
  @ApiProperty({ example: uuidExample })
  id!: string;

  @ApiProperty({ example: 'RF2' })
  referenceCode!: string;

  @ApiProperty({ example: 'Medium Warm' })
  referenceName!: string;

  @ApiPropertyOptional({ example: 'FOUNDATION-X-RF2', nullable: true })
  sku?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  barcode?: string | null;

  @ApiProperty({ example: 0 })
  priceDelta!: number;

  @ApiProperty({ example: 20 })
  stockQuantity!: number;

  @ApiProperty({ example: 0 })
  reservedQuantity!: number;

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

  @ApiProperty({ example: 120 })
  basePrice!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  status!: ProductStatus;

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

  @ApiProperty({ type: ProductReferenceResponse })
  selectedProductReference!: ProductReferenceResponse;
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
