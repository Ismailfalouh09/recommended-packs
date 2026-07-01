import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  OrderStatus,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCartOrderDto } from './dto/create-cart-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { OrderStockService } from './order-stock.service';

type Money = InstanceType<typeof Prisma.Decimal>;

type LoadedRecommendationResult = NonNullable<
  Awaited<ReturnType<OrdersService['loadRecommendationResult']>>
>;

interface PricedOrderItem {
  packId: string | null;
  productId: string;
  productReferenceId: string;
  productNameSnapshot: string;
  referenceNameSnapshot: string;
  skuSnapshot: string | null;
  variationSnapshot: string | null;
  productImageUrlSnapshot: string | null;
  brandNameSnapshot: string | null;
  unitPriceSnapshot: Money;
  originalUnitPriceSnapshot: Money | null;
  quantity: number;
  totalPrice: Money;
}

interface PriceSummary {
  subtotalAmount: Money;
  discountAmount: Money;
  deliveryFee: Money;
  totalAmount: Money;
  items: PricedOrderItem[];
}

interface CartPriceSummary extends PriceSummary {
  currency: string;
}

interface CustomerOrderInput {
  fullName: string;
  phone: string;
  whatsappPhone?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStockService: OrderStockService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const recommendationResult = await this.loadRecommendationResult(
        createOrderDto.recommendationResultId,
        tx,
      );

      if (!recommendationResult) {
        throw new NotFoundException(
          `Recommendation result ${createOrderDto.recommendationResultId} was not found.`,
        );
      }

      this.validateRecommendationResult(recommendationResult);
      const priceSummary = this.calculateOrderPrice(recommendationResult);
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const customer = await this.upsertCustomer(tx, createOrderDto);

      await tx.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: createOrderDto.city,
          addressLine: createOrderDto.addressLine,
          extraInfo: createOrderDto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId:
            recommendationResult.recommendationSession.customerProfile.id,
          recommendationResultId: recommendationResult.id,
          selectedPackId: recommendationResult.packId,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: recommendationResult.pack.currency,
          notes: createOrderDto.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      await tx.recommendationResult.update({
        where: { id: recommendationResult.id },
        data: { isSelected: true },
      });

      return {
        order,
        customer,
        address,
        pack: recommendationResult.pack,
        items: priceSummary.items,
      };
    });

    return this.toOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      pack: created.pack,
      items: created.items,
    });
  }

  async createFromCart(dto: CreateCartOrderDto) {
    const orderNumber = this.generateOrderNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const priceSummary = await this.calculateCartOrderPrice(dto, tx);
      await this.orderStockService.reserveForNewOrder(tx, priceSummary.items);

      const customer = await this.upsertCustomer(tx, dto);

      await tx.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          city: dto.city,
          addressLine: dto.addressLine,
          extraInfo: dto.extraInfo || null,
          isDefault: true,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerProfileId: null,
          recommendationResultId: null,
          selectedPackId: null,
          customerAddressId: address.id,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.UNPAID,
          orderStatus: OrderStatus.PENDING_CONFIRMATION,
          subtotalAmount: priceSummary.subtotalAmount,
          discountAmount: priceSummary.discountAmount,
          deliveryFee: priceSummary.deliveryFee,
          totalAmount: priceSummary.totalAmount,
          currency: priceSummary.currency,
          notes: dto.notes || null,
        },
      });

      await tx.orderItem.createMany({
        data: priceSummary.items.map((item) => ({
          orderId: order.id,
          packId: item.packId,
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          productNameSnapshot: item.productNameSnapshot,
          referenceNameSnapshot: item.referenceNameSnapshot,
          skuSnapshot: item.skuSnapshot,
          variationSnapshot: item.variationSnapshot,
          productImageUrlSnapshot: item.productImageUrlSnapshot,
          brandNameSnapshot: item.brandNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          originalUnitPriceSnapshot: item.originalUnitPriceSnapshot,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        })),
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING_CONFIRMATION,
          comment: 'Order created',
        },
      });

      return {
        order,
        customer,
        address,
        items: priceSummary.items,
      };
    });

    return this.toCartOrderResponse({
      order: created.order,
      customer: created.customer,
      address: created.address,
      items: created.items,
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        orderStatus: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        selectedPack: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: this.toNumber(order.totalAmount),
      currency: order.currency,
      packName: order.selectedPack?.name ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async adminFindAll(query: QueryAdminOrdersDto) {
    this.validateAdminQuery(query);
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const where = this.buildAdminWhere(query);

    const [orders, totalItems] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }],
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentMethod: true,
          paymentStatus: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          customerAddress: {
            select: {
              city: true,
            },
          },
          selectedPack: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginatedResponse(
      orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        totalAmount: toMoneyNumber(order.totalAmount),
        currency: order.currency,
        customer: order.customer,
        address: {
          city: order.customerAddress.city,
        },
        pack: order.selectedPack,
        itemCount: order._count.items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      { ...pagination, totalItems },
    );
  }

  async adminFindOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        subtotalAmount: true,
        discountAmount: true,
        deliveryFee: true,
        totalAmount: true,
        currency: true,
        notes: true,
        packConfigurationSnapshot: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            whatsappPhone: true,
            email: true,
          },
        },
        customerAddress: {
          select: {
            id: true,
            city: true,
            addressLine: true,
            extraInfo: true,
            isDefault: true,
          },
        },
        customerProfile: {
          select: {
            id: true,
            sourceChannel: true,
          },
        },
        selectedPack: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        recommendationResult: {
          select: {
            id: true,
            rank: true,
            totalScore: true,
            matchPercentage: true,
          },
        },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            productId: true,
            productReferenceId: true,
            productNameSnapshot: true,
            referenceNameSnapshot: true,
            skuSnapshot: true,
            variationSnapshot: true,
            productImageUrlSnapshot: true,
            brandNameSnapshot: true,
            unitPriceSnapshot: true,
            originalUnitPriceSnapshot: true,
            quantity: true,
            totalPrice: true,
          },
        },
        statusHistory: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            oldStatus: true,
            newStatus: true,
            comment: true,
            createdAt: true,
            changedByAdmin: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }

    return this.toAdminDetailResponse(order);
  }

  private async loadRecommendationResult(
    recommendationResultId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.recommendationResult.findUnique({
      where: { id: recommendationResultId },
      select: {
        id: true,
        packId: true,
        pack: {
          select: {
            id: true,
            name: true,
            status: true,
            isActive: true,
            priceMode: true,
            fixedPrice: true,
            discountAmount: true,
            discountPercentage: true,
            currency: true,
          },
        },
        recommendationSession: {
          select: {
            customerProfile: {
              select: {
                id: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                compareAtPrice: true,
                mainImageUrl: true,
                isActive: true,
                status: true,
                brand: {
                  select: {
                    name: true,
                  },
                },
                images: {
                  where: { role: MediaRole.COVER },
                  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                  select: {
                    media: {
                      select: {
                        secureUrl: true,
                        url: true,
                      },
                    },
                  },
                },
              },
            },
            selectedProductReference: {
              select: {
                id: true,
                referenceCode: true,
                referenceName: true,
                shadeName: true,
                measurement: true,
                sku: true,
                priceOverride: true,
                priceDelta: true,
                imageUrl: true,
                image: {
                  select: {
                    media: {
                      select: {
                        secureUrl: true,
                        url: true,
                      },
                    },
                  },
                },
                stockQuantity: true,
                reservedQuantity: true,
                isActive: true,
              },
            },
            packItem: {
              select: {
                isRequired: true,
              },
            },
          },
        },
      },
    });
  }

  private validateRecommendationResult(
    recommendationResult: LoadedRecommendationResult,
  ) {
    if (recommendationResult.items.length === 0) {
      throw new BadRequestException(
        'Recommendation result has no selected items.',
      );
    }

    if (
      !recommendationResult.pack.isActive ||
      recommendationResult.pack.status !== PackStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'The selected pack is inactive or archived.',
      );
    }

    for (const item of recommendationResult.items) {
      if (
        !item.product.isActive ||
        item.product.status !== ProductStatus.ACTIVE
      ) {
        throw new BadRequestException(
          `Selected product ${item.product.name} is no longer active.`,
        );
      }

      if (!item.selectedProductReference.isActive) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(item.selectedProductReference)} is no longer active.`,
        );
      }

      if (
        item.packItem.isRequired &&
        item.selectedProductReference.stockQuantity -
          item.selectedProductReference.reservedQuantity <
          item.quantity
      ) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(item.selectedProductReference)} is out of stock.`,
        );
      }
    }
  }

  private async upsertCustomer(
    tx: Prisma.TransactionClient,
    createOrderDto: CustomerOrderInput,
  ) {
    const existingCustomer = await tx.customer.findUnique({
      where: { phone: createOrderDto.phone },
    });

    if (existingCustomer) {
      return tx.customer.update({
        where: { id: existingCustomer.id },
        data: {
          fullName: createOrderDto.fullName,
          whatsappPhone:
            createOrderDto.whatsappPhone || existingCustomer.whatsappPhone,
        },
      });
    }

    return tx.customer.create({
      data: {
        fullName: createOrderDto.fullName,
        phone: createOrderDto.phone,
        whatsappPhone: createOrderDto.whatsappPhone || null,
      },
    });
  }

  private async calculateCartOrderPrice(
    dto: CreateCartOrderDto,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CartPriceSummary> {
    if (!dto.items?.length) {
      throw new BadRequestException('Cart must contain at least one item.');
    }

    const requestedQuantityByReference = new Map<string, number>();

    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('Cart item quantity must be at least 1.');
      }

      requestedQuantityByReference.set(
        item.referenceId,
        (requestedQuantityByReference.get(item.referenceId) ?? 0) +
          item.quantity,
      );
    }

    const zero = this.decimal(0);
    const pricedItems: PricedOrderItem[] = [];
    let currency: string | null = null;

    for (const item of dto.items) {
      const product = await client.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          basePrice: true,
          compareAtPrice: true,
          mainImageUrl: true,
          currency: true,
          isActive: true,
          status: true,
          brand: {
            select: {
              name: true,
            },
          },
          images: {
            where: { role: MediaRole.COVER },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            take: 1,
            select: {
              media: {
                select: {
                  secureUrl: true,
                  url: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} was not found.`);
      }

      if (!product.isActive || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(
          `Product ${product.name} is not active or sellable.`,
        );
      }

      const reference = await client.productReference.findUnique({
        where: { id: item.referenceId },
        select: {
          id: true,
          productId: true,
          referenceCode: true,
          referenceName: true,
          shadeName: true,
          measurement: true,
          sku: true,
          priceOverride: true,
          priceDelta: true,
          imageUrl: true,
          image: {
            select: {
              media: {
                select: {
                  secureUrl: true,
                  url: true,
                },
              },
            },
          },
          stockQuantity: true,
          reservedQuantity: true,
          isActive: true,
        },
      });

      if (!reference) {
        throw new NotFoundException(
          `Reference ${item.referenceId} was not found.`,
        );
      }

      if (reference.productId !== product.id) {
        throw new BadRequestException(
          'Selected reference does not belong to the selected product.',
        );
      }

      if (!reference.isActive) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(reference)} is no longer active.`,
        );
      }

      const requestedQuantity =
        requestedQuantityByReference.get(reference.id) ?? item.quantity;

      if (
        reference.stockQuantity - reference.reservedQuantity <
        requestedQuantity
      ) {
        throw new BadRequestException(
          `Selected reference ${this.referenceSnapshotName(reference)} does not have enough stock.`,
        );
      }

      if (currency && currency !== product.currency) {
        throw new BadRequestException('Cart items must use the same currency.');
      }
      currency = product.currency;

      const unitPrice = this.effectiveProductReferencePrice(product, reference);

      pricedItems.push({
        packId: null,
        productId: product.id,
        productReferenceId: reference.id,
        productNameSnapshot: product.name,
        referenceNameSnapshot: this.referenceSnapshotName(reference),
        skuSnapshot: reference.sku,
        variationSnapshot: this.variationSnapshot(reference),
        productImageUrlSnapshot: this.snapshotImageUrl(product, reference),
        brandNameSnapshot: product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          product,
          unitPrice,
        ),
        quantity: item.quantity,
        totalPrice: unitPrice.times(item.quantity),
      });
    }

    const subtotalAmount = pricedItems.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );
    const discountAmount = zero;
    const deliveryFee = this.deliveryFeeForCity(dto.city);
    const totalAmount = subtotalAmount.plus(deliveryFee).minus(discountAmount);

    return {
      subtotalAmount,
      discountAmount,
      deliveryFee,
      totalAmount,
      currency: currency ?? 'MAD',
      items: pricedItems,
    };
  }

  private calculateOrderPrice(
    recommendationResult: LoadedRecommendationResult,
  ): PriceSummary {
    const zero = this.decimal(0);
    const itemSnapshots = recommendationResult.items.map((item) => {
      const unitPrice = this.effectiveReferencePrice(item);
      const quantity = item.quantity;

      return {
        packId: recommendationResult.packId,
        productId: item.product.id,
        productReferenceId: item.selectedProductReference.id,
        productNameSnapshot: item.product.name,
        referenceNameSnapshot: this.referenceSnapshotName(
          item.selectedProductReference,
        ),
        skuSnapshot: item.selectedProductReference.sku,
        variationSnapshot: this.variationSnapshot(
          item.selectedProductReference,
        ),
        productImageUrlSnapshot: this.snapshotImageUrl(
          item.product,
          item.selectedProductReference,
        ),
        brandNameSnapshot: item.product.brand?.name ?? null,
        unitPriceSnapshot: unitPrice,
        originalUnitPriceSnapshot: this.originalUnitPriceSnapshot(
          item.product,
          unitPrice,
        ),
        quantity,
        totalPrice: unitPrice.times(quantity),
      };
    });

    const itemSubtotal = itemSnapshots.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      zero,
    );

    if (recommendationResult.pack.priceMode === PriceMode.FIXED) {
      if (!recommendationResult.pack.fixedPrice) {
        throw new BadRequestException('Selected pack has no fixed price.');
      }

      const subtotalAmount = this.decimal(recommendationResult.pack.fixedPrice);

      return {
        subtotalAmount,
        discountAmount: zero,
        deliveryFee: zero,
        totalAmount: subtotalAmount,
        items: itemSnapshots,
      };
    }

    if (recommendationResult.pack.priceMode === PriceMode.SUM_ITEMS) {
      return {
        subtotalAmount: itemSubtotal,
        discountAmount: zero,
        deliveryFee: zero,
        totalAmount: itemSubtotal,
        items: itemSnapshots,
      };
    }

    const discountAmount = this.calculateDiscount(
      itemSubtotal,
      recommendationResult.pack.discountAmount,
      recommendationResult.pack.discountPercentage,
    );
    const totalAmount = Prisma.Decimal.max(
      itemSubtotal.minus(discountAmount),
      zero,
    );

    return {
      subtotalAmount: itemSubtotal,
      discountAmount,
      deliveryFee: zero,
      totalAmount,
      items: itemSnapshots,
    };
  }

  private calculateDiscount(
    itemSubtotal: Money,
    discountAmount: Prisma.Decimal | null,
    discountPercentage: Prisma.Decimal | null,
  ): Money {
    if (discountAmount) {
      return Prisma.Decimal.min(this.decimal(discountAmount), itemSubtotal);
    }

    if (discountPercentage) {
      const percentage = this.decimal(discountPercentage);
      const calculated = itemSubtotal.times(percentage).div(100);
      return Prisma.Decimal.min(calculated, itemSubtotal);
    }

    return this.decimal(0);
  }

  private effectiveReferencePrice(
    item: LoadedRecommendationResult['items'][number],
  ): Money {
    return this.effectiveProductReferencePrice(
      item.product,
      item.selectedProductReference,
    );
  }

  private effectiveProductReferencePrice(
    product: { basePrice: Prisma.Decimal },
    reference: {
      priceOverride: Prisma.Decimal | null;
      priceDelta: Prisma.Decimal;
    },
  ): Money {
    if (reference.priceOverride) {
      return this.decimal(reference.priceOverride);
    }

    return this.decimal(product.basePrice).plus(reference.priceDelta);
  }

  private originalUnitPriceSnapshot(
    product: { compareAtPrice?: Prisma.Decimal | null },
    unitPrice: Money,
  ): Money | null {
    if (!product.compareAtPrice) {
      return null;
    }

    const originalPrice = this.decimal(product.compareAtPrice);
    return originalPrice.gt(unitPrice) ? originalPrice : null;
  }

  private variationSnapshot(reference: {
    referenceName: string;
    shadeName?: string | null;
    measurement?: string | null;
  }): string | null {
    const parts = [reference.shadeName, reference.measurement].filter(
      Boolean,
    ) as string[];

    return parts.length > 0 ? parts.join(' / ') : reference.referenceName;
  }

  private snapshotImageUrl(
    product: {
      mainImageUrl?: string | null;
      images?: { media: { secureUrl: string; url?: string | null } }[];
    },
    reference: {
      imageUrl?: string | null;
      image?: { media: { secureUrl: string; url?: string | null } } | null;
    },
  ): string | null {
    return (
      reference.image?.media.secureUrl ??
      reference.image?.media.url ??
      reference.imageUrl ??
      product.images?.[0]?.media.secureUrl ??
      product.images?.[0]?.media.url ??
      product.mainImageUrl ??
      null
    );
  }

  private deliveryFeeForCity(_city: string): Money {
    return this.decimal(0);
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
    const randomPart = crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 6)
      .toUpperCase();

    return `ORD-${datePart}-${randomPart}`;
  }

  private toOrderResponse(input: {
    order: {
      id: string;
      orderNumber: string;
      orderStatus: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      deliveryFee: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      currency: string;
    };
    customer: {
      fullName: string;
      phone: string;
    };
    address: {
      city: string;
      addressLine: string;
    };
    pack: {
      id: string;
      name: string;
    };
    items: PricedOrderItem[];
  }) {
    return {
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      orderStatus: input.order.orderStatus,
      paymentMethod: input.order.paymentMethod,
      paymentStatus: input.order.paymentStatus,
      subtotalAmount: this.toNumber(input.order.subtotalAmount),
      discountAmount: this.toNumber(input.order.discountAmount),
      deliveryFee: this.toNumber(input.order.deliveryFee),
      totalAmount: this.toNumber(input.order.totalAmount),
      currency: input.order.currency,
      customer: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
      },
      address: {
        city: input.address.city,
        addressLine: input.address.addressLine,
      },
      pack: {
        id: input.pack.id,
        name: input.pack.name,
      },
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        referenceId: item.productReferenceId,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPriceSnapshot),
        originalUnitPrice:
          item.originalUnitPriceSnapshot != null
            ? this.toNumber(item.originalUnitPriceSnapshot)
            : null,
        totalPrice: this.toNumber(item.totalPrice),
      })),
    };
  }

  private toCartOrderResponse(input: {
    order: {
      id: string;
      orderNumber: string;
      orderStatus: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      deliveryFee: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      currency: string;
    };
    customer: {
      fullName: string;
      phone: string;
    };
    address: {
      city: string;
      addressLine: string;
    };
    items: PricedOrderItem[];
  }) {
    return {
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      orderStatus: input.order.orderStatus,
      paymentMethod: input.order.paymentMethod,
      paymentStatus: input.order.paymentStatus,
      subtotalAmount: this.toNumber(input.order.subtotalAmount),
      discountAmount: this.toNumber(input.order.discountAmount),
      deliveryFee: this.toNumber(input.order.deliveryFee),
      totalAmount: this.toNumber(input.order.totalAmount),
      currency: input.order.currency,
      customer: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
      },
      address: {
        city: input.address.city,
        addressLine: input.address.addressLine,
      },
      pack: null,
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        referenceId: item.productReferenceId,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPriceSnapshot),
        originalUnitPrice:
          item.originalUnitPriceSnapshot != null
            ? this.toNumber(item.originalUnitPriceSnapshot)
            : null,
        totalPrice: this.toNumber(item.totalPrice),
      })),
    };
  }

  private referenceSnapshotName(reference: {
    referenceCode: string;
    referenceName: string;
  }): string {
    return `${reference.referenceCode} ${reference.referenceName}`;
  }

  private decimal(value: Prisma.Decimal.Value): Money {
    return new Prisma.Decimal(value);
  }

  private toNumber(value: Prisma.Decimal): number {
    return value.toNumber();
  }

  private validateAdminQuery(query: QueryAdminOrdersDto) {
    if (
      query.createdFrom &&
      query.createdTo &&
      new Date(query.createdFrom) > new Date(query.createdTo)
    ) {
      throw new BadRequestException('createdFrom cannot be after createdTo.');
    }

    if (
      query.minTotal !== undefined &&
      query.maxTotal !== undefined &&
      query.minTotal > query.maxTotal
    ) {
      throw new BadRequestException(
        'minTotal cannot be greater than maxTotal.',
      );
    }
  }

  private buildAdminWhere(query: QueryAdminOrdersDto): Prisma.OrderWhereInput {
    return {
      ...(query.orderStatus ? { orderStatus: query.orderStatus } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.selectedPackId ? { selectedPackId: query.selectedPackId } : {}),
      ...(query.sourceChannel
        ? { customerProfile: { sourceChannel: query.sourceChannel } }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom
                ? { gte: new Date(query.createdFrom) }
                : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.minTotal !== undefined || query.maxTotal !== undefined
        ? {
            totalAmount: {
              ...(query.minTotal !== undefined ? { gte: query.minTotal } : {}),
              ...(query.maxTotal !== undefined ? { lte: query.maxTotal } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                orderNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  fullName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  phone: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private toAdminDetailResponse(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      subtotalAmount: toMoneyNumber(order.subtotalAmount),
      discountAmount: toMoneyNumber(order.discountAmount),
      deliveryFee: toMoneyNumber(order.deliveryFee),
      totalAmount: toMoneyNumber(order.totalAmount),
      currency: order.currency,
      notes: order.notes,
      // Pack Core Evolution (Phase 3) — surface the frozen pack-configuration
      // snapshot only when the order actually carries one. Legacy/non-configured
      // orders omit the field entirely (null snapshot).
      ...(order.packConfigurationSnapshot != null
        ? { packConfigurationSnapshot: order.packConfigurationSnapshot }
        : {}),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: order.customer,
      address: order.customerAddress,
      customerProfile: order.customerProfile,
      pack: order.selectedPack,
      recommendationResult: order.recommendationResult
        ? {
            ...order.recommendationResult,
            matchPercentage: toMoneyNumber(
              order.recommendationResult.matchPercentage,
            ),
          }
        : null,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        referenceId: item.productReferenceId,
        productName: item.productNameSnapshot,
        referenceName: item.referenceNameSnapshot,
        sku: item.skuSnapshot,
        variation: item.variationSnapshot,
        imageUrl: item.productImageUrlSnapshot,
        brandName: item.brandNameSnapshot,
        quantity: item.quantity,
        unitPrice: toMoneyNumber(item.unitPriceSnapshot),
        originalUnitPrice: toMoneyNumber(item.originalUnitPriceSnapshot),
        totalPrice: toMoneyNumber(item.totalPrice),
      })),
      statusHistory: order.statusHistory.map((history: any) => ({
        id: history.id,
        oldStatus: history.oldStatus,
        newStatus: history.newStatus,
        comment: history.comment,
        changedByAdmin: history.changedByAdmin,
        createdAt: history.createdAt,
      })),
    };
  }
}
